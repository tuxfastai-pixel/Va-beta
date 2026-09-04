import { getLearningEvents, getProfileAIMemory, updateProfileAIMemory, type AgentMemory } from "@/lib/learning/learningEngine";
import type { ProfileIntelligenceOutput } from "@/lib/profile/profileIntelligenceRuntime";
import { evolveResumeVariants } from "@/lib/resume/resumeEvolution";
import { generateBaseResume, generateNicheResume } from "@/lib/resume/resumeGenerator";
import { scoreResumeRealism } from "@/lib/resume/resumeRealism";
import { buildResumeVariants } from "@/lib/resume/resumeVariants";
import { scoreIdentityCohesion } from "@/lib/profile/identityCohesion";
import { assessRecruiterSuspicionRisk } from "../governance/recruiterSuspicionRisk.ts";
import { gatekeepMutation } from "../governance/hardConstraintEnforcement.ts";
import { runEquilibriumLearning, type EquilibriumMemoryState } from "../governance/equilibriumLearning.ts";
import { buildEquilibriumDiagnosticsPayload } from "../governance/equilibriumTelemetry.ts";

export interface ResumeIntelligenceInput {
  userId: string;
  fullName?: string;
  location?: string;
  selectedCareers?: string[];
  interests?: string[];
  skills?: string[];
  desiredIncome?: number;
  experienceSummary?: string;
  profileIntelligence: ProfileIntelligenceOutput;
}

export async function runResumeIntelligenceRuntime(input: ResumeIntelligenceInput) {
  const events = await getLearningEvents(input.userId);
  const memory = await getProfileAIMemory(input.userId);

  const specialization = input.profileIntelligence.specialization;
  const baseResume = generateBaseResume({
    fullName: input.fullName,
    location: input.location,
    selectedCareers: input.selectedCareers ?? [],
    interests: input.interests ?? [],
    skills: input.skills ?? [],
    desiredIncome: input.desiredIncome,
    experienceSummary: input.experienceSummary,
    specialization,
    recommendedNiche: input.profileIntelligence.marketSignals.recommendedProactiveShift || input.profileIntelligence.marketPositioning.recommendedNicheFocus,
  });

  const nicheResumes = specialization.inferredNiches.slice(0, 5).map((niche) => generateNicheResume(
    baseResume,
    niche.niche,
    (niche.niche || "operations").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) + " Resume",
    niche.matchedKeywords
  ));

  const variants = buildResumeVariants({
    baseResume,
    nicheResumes,
    profileVariants: input.profileIntelligence.profileVariants,
  });

  const realism = scoreResumeRealism(
    Object.values(variants).map((variant) => ({
      key: variant.key,
      text: variant.text,
      atsKeywords: variant.prioritizedKeywords,
    }))
  );

  const evolution = evolveResumeVariants(variants, events);
  const identityCohesion = scoreIdentityCohesion({
    primaryIdentity: input.profileIntelligence.identityEvolution.primaryIdentity.identityLabel,
    primarySpecialization: specialization.primarySpecialization,
    primaryResumeVariant: evolution.primaryVariant,
    profileVariants: input.profileIntelligence.profileVariants,
    resumeVariants: variants,
  });
  const suspicionRisk = assessRecruiterSuspicionRisk(baseResume);

  const equilibriumState =
    memory.resume_intelligence &&
    typeof memory.resume_intelligence === "object" &&
    "equilibrium_learning" in memory.resume_intelligence &&
    memory.resume_intelligence.equilibrium_learning &&
    typeof memory.resume_intelligence.equilibrium_learning === "object"
      ? (memory.resume_intelligence.equilibrium_learning as EquilibriumMemoryState)
      : undefined;

  const mutationPattern = "ats_keyword_expansion";
  const preferredPatterns = equilibriumState?.preferredMutationPatterns || [];
  const discouragedPatterns = equilibriumState?.discouragedPatterns || [];
  const strategyWeight = preferredPatterns.includes(mutationPattern)
    ? 1
    : discouragedPatterns.includes(mutationPattern)
      ? 0.6
      : 0.8;

  const atsKeywordTarget = Math.max(2, Math.min(8, Math.round(6 * strategyWeight)));
  const warningDensity = Math.min(1, realism.warnings.length / 8);
  const warningHistory = [Math.max(0, warningDensity - 0.08), Math.max(0, warningDensity - 0.03), warningDensity];
  const riskHistory = [
    Math.max(0, suspicionRisk.overallRiskScore - 0.08),
    Math.max(0, suspicionRisk.overallRiskScore - 0.03),
    suspicionRisk.overallRiskScore,
  ];
  const driftHistory = [
    Math.max(0, identityCohesion.divergenceRisk / 100 - 0.06),
    Math.max(0, identityCohesion.divergenceRisk / 100 - 0.02),
    Math.max(0, Math.min(1, identityCohesion.divergenceRisk / 100)),
  ];

  const governanceDecision = await gatekeepMutation({
    resume: baseResume,
    targetKeywords: specialization.atsKeywords,
    adaptationReason: "ats_optimization",
    proposedChanges: {
      keywordsToAdd: specialization.atsKeywords.slice(0, atsKeywordTarget),
      keywordsToRemove: [],
      summaryUpdates: baseResume.summary,
      skillReordering: baseResume.coreSkills,
    },
    governanceState: {
      realismScore: realism.overall / 100,
      alignmentScore: evolution.confidence,
      fragmentation: Math.max(0, Math.min(1, identityCohesion.divergenceRisk / 100)),
      recruiterSuspicionRisk: suspicionRisk.overallRiskScore,
      mutations: Math.min(10, events.length),
      emergencyFreeze: false,
    },
    warningDensity,
    governanceHealth: Number(Math.max(0.2, 1 - warningDensity * 0.85).toFixed(4)),
    trustConsistency: Number(Math.max(0.1, 1 - suspicionRisk.overallRiskScore).toFixed(4)),
    stabilityAge: Math.max(1, events.length),
    recruiterTrustScore: Number(Math.max(0, 1 - suspicionRisk.overallRiskScore).toFixed(4)),
    alignmentConsistency: Number(Math.max(0, evolution.confidence).toFixed(4)),
    realismPersistence: Number((realism.overall / 100).toFixed(4)),
    identityFragmentationRisk: Number(Math.max(0, Math.min(1, identityCohesion.divergenceRisk / 100)).toFixed(4)),
    warningHistory,
    riskHistory,
    driftHistory,
  });

  const interventionCount = governanceDecision.governanceCheckpoint.rejectionCount;
  const trustDelta = governanceDecision.approved ? 0.06 : -0.08;
  const learning = runEquilibriumLearning(
    {
      mutationPattern,
      stabilityEfficiencyRatio: Number(
        Math.max(
          0.1,
          Math.min(1, (governanceDecision.governanceCheckpoint.approvalCount + 1) / (interventionCount + 2))
        ).toFixed(4)
      ),
      realismRetention: Number((realism.overall / 100).toFixed(4)),
      recruiterTrustDelta: trustDelta,
      governorInterventions: interventionCount,
    },
    equilibriumState
  );

  const stabilityEfficiencyRatio = Number(
    Math.max(
      0.1,
      Math.min(1, (governanceDecision.governanceCheckpoint.approvalCount + 1) / (interventionCount + 2))
    ).toFixed(4)
  );

  const previousRecoveryFrequency =
    memory.mutation_policy_memory &&
    typeof memory.mutation_policy_memory === "object" &&
    typeof memory.mutation_policy_memory.recovery_frequency === "number"
      ? memory.mutation_policy_memory.recovery_frequency
      : 0;

  const equilibriumDiagnostics = buildEquilibriumDiagnosticsPayload({
    decision: governanceDecision,
    warningHistory,
    riskHistory,
    stabilityEfficiencyRatio,
    learning: learning.output,
    identityFragmentationRisk: Math.max(0, Math.min(1, identityCohesion.divergenceRisk / 100)),
    previousRecoveryFrequency,
  });

  const freezeResumeEvolution = governanceDecision.mutationFrozen || !governanceDecision.approved;
  const governedThrottle = freezeResumeEvolution
    ? 0
    : Number((realism.throttle * Math.max(0.25, governanceDecision.appliedMultiplier || 1)).toFixed(2));

  const honestyLayer = {
    rule: "amplify_reality_not_fabrication",
    disallowed: [
      "fake employment",
      "fake certifications",
      "fake experience",
    ],
    guardrails: [
      "Prefer transferable skill framing.",
      "Use defensible wording for tools and role scope.",
      "Block unsupported expert-level claims.",
    ],
  };

  const explainability = {
    whyPrimaryVariant: `Primary resume variant is ${evolution.primaryVariant} based on observed callback/interview/conversion outcomes.`,
    whyChanged: `Resume evolution confidence ${Math.round(evolution.confidence * 100)}% with realism throttle ${Math.round(realism.throttle * 100)}%.`,
    realismWarnings: realism.warnings,
    cohesionWarnings: identityCohesion.flags,
    wordingHints: evolution.wordingHints,
    orderingHints: evolution.orderingHints,
    emphasisHints: evolution.emphasisHints,
    governance: {
      freezeResumeEvolution,
      approvals: governanceDecision.governanceCheckpoint.approvalCount,
      rejections: governanceDecision.governanceCheckpoint.rejectionCount,
      blockingReasons: governanceDecision.governanceCheckpoint.blockingReasons,
      appliedMultiplier: governanceDecision.appliedMultiplier,
      tempoMode: governanceDecision.debugInfo.tempo.mode,
      mutationCooldownMs: governanceDecision.debugInfo.tempo.mutationCooldownMs,
      inertiaState: governanceDecision.debugInfo.inertia.inertiaState,
      equilibriumScore: learning.output.equilibriumScore,
      systemEmotionalState: equilibriumDiagnostics.systemEmotionalState,
      warningGrowthRate: equilibriumDiagnostics.gradient.warningGrowthRate,
      riskGrowthRate: equilibriumDiagnostics.gradient.riskGrowthRate,
      recoveryFrequency: equilibriumDiagnostics.equilibrium.recoveryFrequency,
    },
  };

  const previousHistory = Array.isArray(memory.positioning_memory?.history) ? memory.positioning_memory.history : [];
  const history = [
    ...previousHistory,
    {
      recorded_at: new Date().toISOString(),
      primary_specialization: specialization.primarySpecialization,
      primary_identity: input.profileIntelligence.identityEvolution.primaryIdentity.identityLabel,
      confidence_score: input.profileIntelligence.profileConfidenceScore,
      market_focus: input.profileIntelligence.marketSignals.recommendedProactiveShift || input.profileIntelligence.marketPositioning.recommendedNicheFocus,
    },
  ].slice(-40);

  const resumeMemoryPatch: AgentMemory = {
    resume_intelligence: {
      updated_at: new Date().toISOString(),
      base_resume: baseResume,
      niche_resumes: nicheResumes,
      variants,
      evolution,
      realism,
      cohesion: identityCohesion,
      honesty_layer: honestyLayer,
      explainability,
      primary_resume_variant: evolution.primaryVariant,
      deployment_throttle: governedThrottle,
      equilibrium_learning: learning.state,
      equilibrium_diagnostics: equilibriumDiagnostics,
      history,
    },
    mutation_policy_memory: {
      updated_at: new Date().toISOString(),
      strategy_weighting: {
        mutation_pattern: mutationPattern,
        selected_weight: strategyWeight,
        preferred_patterns: learning.output.preferredMutationPatterns,
        discouraged_patterns: learning.output.discouragedPatterns,
      },
      equilibrium_score: learning.output.equilibriumScore,
      stability_efficiency_ratio: stabilityEfficiencyRatio,
      recovery_frequency: equilibriumDiagnostics.equilibrium.recoveryFrequency,
    },
  };

  await updateProfileAIMemory(input.userId, resumeMemoryPatch);

  return {
    baseResume,
    nicheResumes,
    variants,
    evolution,
    realism,
    governance: governanceDecision,
    equilibriumDiagnostics,
    honestyLayer,
    explainability,
  };
}
