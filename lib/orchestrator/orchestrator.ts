import { recordEvent } from "@/lib/learning/learningEngine";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildDailyStrategy } from "@/lib/ai/dailyStrategy";
import { runIntelligenceCycle } from "@/lib/intelligence/runtime";
import { runProfileIntelligenceRuntime } from "@/lib/profile/profileIntelligenceRuntime";
import { runResumeIntelligenceRuntime } from "@/lib/resume/resumeIntelligenceRuntime";
import { generateExplainableGovernanceReport, type AdaptiveActionCategory } from "@/lib/governance/explainableGovernanceReport.ts";
import { decideNextAction } from "./decisionEngine";
import { buildUserSystemState, getUserState } from "./stateManager";
import { runJobHunter, runJobHunterForCareer, runProposalEngine, runProposalEngineForCareer, runTask } from "./taskRunner";
import { acquireLock, releaseLock } from "@/lib/runtime/lockManager";
import { withTaskReservation } from "@/lib/runtime/taskReservation";
import { isOrchestratorPausedGlobally } from "@/lib/intelligence/governance";
import {
  appendAutonomyAcceptance,
  appendTrustTransition,
  appendTrustWindow,
  loadTrustHistoryRecord,
  summarizeTrustHistory,
} from "@/lib/trust/trustHistoryStore";
import { evaluateTrustDriftForUser } from "@/lib/trust/trustDriftEngine";
import { evaluateOrchestrationTrustGate } from "@/lib/trust/trustOrchestrationGate";
import { loadFeatureRolloutPolicy } from "@/lib/governance/featureRolloutStore";
import { isShadowModeForUser } from "@/lib/governance/featureRollout";
import { appendShadowModeDecision } from "@/lib/governance/shadowModeDecisionLog";
import { loadSessionContinuityRecord } from "@/lib/continuity/sessionContinuityStore";
import { learnAutonomyProfile, summarizeAutonomyProfile } from "@/lib/autonomy/autonomyProfile.ts";
import { summarizeInterventionAcceptance } from "@/lib/autonomy/interventionAcceptanceLearning.ts";
import {
  getRequiredAutonomyStageForAction,
  resolveAdaptivePermissionBoundary,
} from "@/lib/autonomy/adaptivePermissionBoundary.ts";
import { predictTrustAwareRollback } from "@/lib/autonomy/trustAwareRollbackPrediction.ts";
import { summarizeRecoveryEffectiveness } from "@/lib/autonomy/recoveryEffectivenessLearning.ts";
import { appendInvariantAuditEntry } from "@/lib/governance/invariantAuditLog.ts";
import { scoreAutonomyConfidence } from "@/lib/autonomy/autonomyConfidence.ts";
import { loadDeploymentSafetyConfig } from "@/lib/governance/deploymentSafetyStore.ts";
import { appendDecisionProvenance } from "@/lib/governance/decisionProvenance.ts";
import { arbitrateGovernanceDecision, type GovernanceArbitrationAuthority } from "@/lib/governance/governanceArbitrator.ts";
import type { ATSPlatform } from "@/lib/profile/atsOptimizationEngine";
import type { SystemPressureState } from "@/lib/ui/notificationOrchestrator";

type OrchestratorUser = {
  id?: string;
  user_id?: string;
  skills?: string[] | string | null;
  resume?: string | null;
  profile?: string | null;
  autonomous_mode?: boolean | null;
  autoApplyEnabled?: boolean | null;
  safe_mode?: boolean | null;
  system_paused?: boolean | null;
  trusted?: boolean | null;
  allowAutoSendMessages?: boolean | null;
  job_queue?: unknown[];
  pendingProposals?: unknown[] | number | null;
  activeClients?: unknown[] | number | null;
  activeWork?: unknown[] | number | null;
  earnings_tracker?: Record<string, unknown>;
  platformsCompleted?: boolean | number | null;
  profileReady?: boolean | null;
  careers?: string[] | null;
  primary_career?: string | null;
  secondary_careers?: string[] | null;
  interests?: string[] | null;
  desired_income?: number | null;
  experience_summary?: string | null;
  location?: string | null;
  platform_targets?: string[] | null;
};

function resolveUserId(user: OrchestratorUser) {
  return String(user.id || user.user_id || "").trim() || null;
}

function normalizeSkills(skills: OrchestratorUser["skills"]): string[] {
  if (Array.isArray(skills)) {
    return skills.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof skills === "string" && skills.trim()) {
    return skills
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizePlatforms(platforms: OrchestratorUser["platform_targets"]): ATSPlatform[] {
  const source = Array.isArray(platforms) ? platforms : [];
  const allowed: ATSPlatform[] = ["linkedin", "indeed", "flexjobs", "pnet", "careerjunction", "careers24", "generic"];
  const normalized = source
    .map((item) => String(item || "").toLowerCase().trim())
    .filter((item): item is ATSPlatform => allowed.includes(item as ATSPlatform));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["linkedin", "indeed", "flexjobs", "generic"];
}

function isMissingOrchestratorTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("orchestrator_logs") && (message.includes("could not find the table") || message.includes("does not exist"));
}

function toNotificationPressureState(state: string): SystemPressureState {
  const normalized = String(state || "").toLowerCase();

  if (normalized.includes("lock") || normalized.includes("paused")) {
    return "locked";
  }

  if (normalized.includes("recover") || normalized.includes("safe")) {
    return "recovery";
  }

  if (normalized.includes("stabil")) {
    return "stabilizing";
  }

  if (normalized.includes("active") || normalized.includes("refin") || normalized.includes("accelerat")) {
    return "accelerated";
  }

  return "balanced";
}

function toProvenanceAuthoritySource(
  authority: GovernanceArbitrationAuthority,
): "operator" | "invariant" | "confidence" | "rollout-mode" | "trust-gate" | "default" {
  if (authority === "invariant") {
    return "invariant";
  }

  if (authority === "confidence") {
    return "confidence";
  }

  if (authority === "rollout-mode") {
    return "rollout-mode";
  }

  if (authority === "trust-regulation") {
    return "trust-gate";
  }

  return "default";
}

async function logOrchestratorRun(userId: string | null, state: string, action: string, result: unknown) {
  const { error } = await supabaseServer.from("orchestrator_logs").insert({
    user_id: userId,
    state,
    action,
    result,
    created_at: new Date().toISOString(),
  });

  if (error && !isMissingOrchestratorTable(error)) {
    console.error(`Failed to log orchestrator run: ${error.message}`);
  }
}

export async function runRevenueLoop(user: OrchestratorUser) {
  const userId = resolveUserId(user);
  const normalizedCareers = Array.from(
    new Set(
      [
        ...(Array.isArray(user.careers) ? user.careers : []),
        String(user.primary_career || "").trim(),
        ...(Array.isArray(user.secondary_careers) ? user.secondary_careers : []),
      ].filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    )
  ).slice(0, 3);

  const profileIntelligence = userId
    ? await runProfileIntelligenceRuntime({
      userId,
      selectedCareers: normalizedCareers,
      skillsDetected: normalizeSkills(user.skills),
      regionalTrends: user.location ? [user.location] : [],
      platforms: normalizePlatforms(user.platform_targets),
    }).catch(() => null)
    : null;

  const resumeIntelligence = userId && profileIntelligence
    ? await runResumeIntelligenceRuntime({
      userId,
      fullName: undefined,
      location: user.location || undefined,
      selectedCareers: normalizedCareers,
      interests: Array.isArray(user.interests) ? user.interests : [],
      skills: normalizeSkills(user.skills),
      desiredIncome: Number(user.desired_income || 0) || undefined,
      experienceSummary: user.experience_summary || undefined,
      profileIntelligence,
    }).catch(() => null)
    : null;

  const identityLabel = profileIntelligence?.identityEvolution.primaryIdentity.identityLabel
    ?? profileIntelligence?.specialization.primarySpecialization
    ?? undefined;
  const atsKeywordSample = profileIntelligence?.profileVariants.indeed_profile.prioritizedKeywords.slice(0, 10)
    ?? profileIntelligence?.specialization.atsKeywords.slice(0, 8)
    ?? [];
  const profileConfidence = profileIntelligence?.profileConfidenceScore;
  const identityStability = profileIntelligence?.identityStability.score;
  const reinforcementAggressiveness = profileIntelligence?.identityStability.reinforcementAggressiveness;
  const explainability = profileIntelligence?.explainability;
  const profileVariants = profileIntelligence?.profileVariants;
  const resumeVariants = resumeIntelligence?.variants;
  const primaryResumeVariant = resumeIntelligence?.evolution.primaryVariant;
  const resumeRealism = resumeIntelligence?.realism.overall;
  const resumeDeploymentThrottle = resumeIntelligence?.realism.throttle;

  if (normalizedCareers.length === 0) {
    const discovery = await runJobHunter(user as Parameters<typeof runJobHunter>[0]);
    const topJobs = Array.isArray(discovery?.data) ? discovery.data : [];
    const proposalRun = await runProposalEngine({
      ...user,
      job_queue: topJobs,
      identity_label: identityLabel,
      ats_keywords: atsKeywordSample,
      profile_confidence: profileConfidence,
      identity_stability: identityStability,
      reinforcement_aggressiveness: reinforcementAggressiveness,
      explainability,
      profile_variants: profileVariants,
      resume_variants: resumeVariants,
      primary_resume_variant: primaryResumeVariant,
      resume_realism: resumeRealism,
      resume_deployment_throttle: resumeDeploymentThrottle,
    } as Parameters<typeof runProposalEngine>[0]);

    if (userId) {
      await recordEvent(userId, "revenue_loop_run", {
        jobs_considered: topJobs.length,
        autoApplyEnabled: user.autoApplyEnabled !== false,
        identity_label: identityLabel,
        profile_confidence: profileConfidence,
        identity_stability: identityStability,
        reinforcement_aggressiveness: reinforcementAggressiveness,
        primary_resume_variant: primaryResumeVariant,
        resume_realism: resumeRealism,
      });
    }

    return {
      jobs_considered: topJobs.length,
      top_jobs: topJobs,
      proposals: proposalRun?.data || [],
      discovery_feedback: discovery?.feedback,
      profile_intelligence: profileIntelligence,
      resume_intelligence: resumeIntelligence,
    };
  }

  let performanceRows: Array<{ career?: string; applications?: number; replies?: number; conversions?: number; revenue?: number }> = [];

  if (userId) {
    const { data } = await supabaseServer
      .from("career_performance")
      .select("career, applications, replies, conversions, revenue")
      .eq("user_id", userId)
      .in("career", normalizedCareers);

    performanceRows = (data || []) as Array<{ career?: string; applications?: number; replies?: number; conversions?: number; revenue?: number }>;
  }

  if (performanceRows.length === 0) {
    performanceRows = normalizedCareers.map((career) => ({
      career,
      applications: 1,
      replies: 0,
      conversions: 0,
      revenue: 0,
    }));
  }

  const strategy = buildDailyStrategy(performanceRows);
  const topJobs: unknown[] = [];
  const proposals: unknown[] = [];

  for (const career of normalizedCareers) {
    const weight = strategy.allocation[career] ?? (career === normalizedCareers[0] ? 0.7 : 0.3 / Math.max(1, normalizedCareers.length - 1));
    const limit = Math.max(1, Math.floor(10 * weight));

    const discovery = await runJobHunterForCareer(user, career, { limit });
    const scopedJobs = Array.isArray(discovery.data) ? discovery.data : [];
    const proposalRun = await runProposalEngineForCareer({
      ...user,
      job_queue: scopedJobs,
      identity_label: identityLabel,
      ats_keywords: atsKeywordSample,
      profile_confidence: profileConfidence,
      identity_stability: identityStability,
      reinforcement_aggressiveness: reinforcementAggressiveness,
      explainability,
      profile_variants: profileVariants,
      resume_variants: resumeVariants,
      primary_resume_variant: primaryResumeVariant,
      resume_realism: resumeRealism,
      resume_deployment_throttle: resumeDeploymentThrottle,
    }, career, { limit });

    topJobs.push(...scopedJobs);
    proposals.push(...(Array.isArray(proposalRun.data) ? proposalRun.data : []));
  }

  if (userId) {
    await recordEvent(userId, "revenue_loop_run", {
      jobs_considered: topJobs.length,
      careers: normalizedCareers,
      allocation: strategy.allocation,
      autoApplyEnabled: user.autoApplyEnabled !== false,
        identity_label: identityLabel,
        profile_confidence: profileConfidence,
        identity_stability: identityStability,
        reinforcement_aggressiveness: reinforcementAggressiveness,
        primary_resume_variant: primaryResumeVariant,
        resume_realism: resumeRealism,
    });
  }

  return {
    jobs_considered: topJobs.length,
    top_jobs: topJobs,
    proposals,
    strategy,
    discovery_feedback: "Career-weighted discovery executed",
    profile_intelligence: profileIntelligence,
    resume_intelligence: resumeIntelligence,
  };
}

export async function runOrchestrator(user: OrchestratorUser) {
  if (await isOrchestratorPausedGlobally()) {
    return {
      status: "paused",
      reason: "orchestrator paused by governance",
    };
  }

  const resolvedUserId = resolveUserId(user) || "anonymous";
  const orchestratorId = `orchestrator:user:${resolvedUserId}`;

  const lock = await acquireLock(`orchestrator:user:${resolvedUserId}`, orchestratorId, {
    leaseSeconds: 180,
    retryWindowMs: 300,
    maxRetries: 1,
    metadata: { mode: "user", userId: resolvedUserId },
  });

  if (!lock.acquired) {
    return {
      status: "skipped",
      reason: "user orchestrator lock already held",
    };
  }

  try {
  const stateContext = buildUserSystemState(user);
  const normalizedUser = {
    ...user,
    ...stateContext,
    safe_mode: user.safe_mode ?? true,
    allowAutoSendMessages: user.safe_mode ? false : (user.allowAutoSendMessages ?? true),
    autoApplyEnabled: user.safe_mode || !user.trusted ? false : (user.autoApplyEnabled ?? true),
  };

  if (normalizedUser.system_paused) {
    const pausedResult = {
      status: "paused",
      message: "System is manually paused",
    };

    await logOrchestratorRun(resolveUserId(normalizedUser), "paused", "paused", pausedResult);
    return pausedResult;
  }

  const state = getUserState(normalizedUser);
  const notificationPressureState = toNotificationPressureState(state);

  console.log("STATE:", state);

  const trustRecord = await loadTrustHistoryRecord(resolvedUserId);
  const continuityRecord = await loadSessionContinuityRecord(resolvedUserId).catch(() => null);
  const deploymentSafetyConfig = await loadDeploymentSafetyConfig().catch(() => null);
  const trustDriftAlerts = await evaluateTrustDriftForUser(resolvedUserId).catch(() => []);

  if (normalizedUser.autonomous_mode === false) {
    const preview = {
      state,
      notificationPressureState,
      action: "awaiting_user_action",
      result: null,
      context: stateContext,
    };

    await logOrchestratorRun(resolveUserId(normalizedUser), state, "awaiting_user_action", preview.result);
    return preview;
  }

  const action = decideNextAction(state, normalizedUser);
  const trustGate = evaluateOrchestrationTrustGate({
    action,
    record: trustRecord,
    driftAlerts: trustDriftAlerts,
  });
  const trustSummary = summarizeTrustHistory(trustRecord);
  const interventionAcceptance = summarizeInterventionAcceptance(trustRecord);
  const recoveryEffectiveness = summarizeRecoveryEffectiveness({
    continuityRecord,
    trustRecord,
  });

  const recentRecoveryWindow = continuityRecord?.equilibriumRecoveryHistory.slice(-20) ?? [];
  const averageRecoveryConfidence =
    recentRecoveryWindow.length > 0
      ? recentRecoveryWindow.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / recentRecoveryWindow.length
      : 0.5;
  const recentInterruptionCount = continuityRecord?.interruptionCauses.slice(-20).length ?? 0;
  const interruptionPenalty = Math.max(0.3, 1 - Math.min(0.7, recentInterruptionCount / 20));
  const continuityStabilityEstimate = Math.max(0, Math.min(1, averageRecoveryConfidence * interruptionPenalty));

  const autonomyProfile = await learnAutonomyProfile(
    resolvedUserId,
    {
      automationComfort: trustGate.metrics.adaptiveComfortIndex,
      pacingTolerance: trustGate.metrics.pacingRespectScore,
      workspaceFlexibility: Math.max(0, 1 - trustGate.signals.modeOverrideRate),
      interruptionTolerance: Math.max(0, 1 - trustGate.signals.resumeAbandonmentRate),
      adaptationAcceptance: interventionAcceptance.acceptanceScore,
      rollbackSensitivity: trustGate.signals.rollbackFrequencyRate,
      continuityStability: continuityStabilityEstimate,
      interventionAcceptance: interventionAcceptance.acceptanceScore,
      recoveryResponsiveness: recoveryEffectiveness.overallResponsiveness,
    },
    { mutationKey: `autonomy-profile:${resolvedUserId}:${Date.now()}:${state}` },
  );

  const permissionBoundary = resolveAdaptivePermissionBoundary({
    profile: autonomyProfile,
    trustRegime: trustSummary.trustRegime,
    trustMomentum: trustSummary.trustMomentum,
  });

  const featureRolloutPolicy = await loadFeatureRolloutPolicy().catch(() => null);
  const shadowModeActive =
    featureRolloutPolicy !== null &&
    isShadowModeForUser(featureRolloutPolicy, {
      userId: resolvedUserId,
      isInRecoveryMode: trustGate.trustRegime === "guarded",
    });

  const previousRegime = trustRecord.transitions[trustRecord.transitions.length - 1]?.nextRegime ?? "balanced";
  if (previousRegime !== trustGate.trustRegime) {
    await appendTrustTransition(
      resolvedUserId,
      {
        timestamp: Date.now(),
        previousRegime,
        nextRegime: trustGate.trustRegime,
        reason: trustGate.reasoning.join(" | ") || "orchestrator trust gate update",
      },
      { mutationKey: `trust-transition:${resolvedUserId}:${Date.now()}:${trustGate.trustRegime}` },
    );
  }

  await appendTrustWindow(
    resolvedUserId,
    {
      timestamp: Date.now(),
      metrics: trustGate.metrics,
      signals: trustGate.signals,
      source: "orchestrator_user_cycle",
    },
    { mutationKey: `trust-window:${resolvedUserId}:${Date.now()}:${state}` },
  );

  if (!shadowModeActive && trustGate.trustRegime === "guarded") {
    normalizedUser.safe_mode = true;
    normalizedUser.allowAutoSendMessages = false;
    normalizedUser.autoApplyEnabled = false;
  } else if (!shadowModeActive && trustGate.trustRegime === "balanced") {
    normalizedUser.allowAutoSendMessages = false;
  }

  const initialAction = shadowModeActive ? action : trustGate.recommendedAction;

  const rollbackPrediction = predictTrustAwareRollback({
    action: initialAction,
    actionStage: getRequiredAutonomyStageForAction(initialAction),
    trustRegime: trustSummary.trustRegime,
    trustMomentum: trustSummary.trustMomentum,
    driftAlerts: trustDriftAlerts,
    profile: autonomyProfile,
  });

  const autonomyConfidence = scoreAutonomyConfidence({
    decision: initialAction,
    actionStage: getRequiredAutonomyStageForAction(initialAction),
    rollbackProbability: rollbackPrediction.rollbackProbability,
    trustDisruptionProbability: rollbackPrediction.trustDisruptionProbability,
    interruptionCost: rollbackPrediction.interruptionCost,
    adaptiveComfort: autonomyProfile.automationComfort,
    interventionAcceptanceScore: interventionAcceptance.acceptanceScore,
    recoveryResponsiveness: recoveryEffectiveness.overallResponsiveness,
  });

  const mostRecentOverride = [...trustRecord.autonomyAcceptance].reverse().find((entry) => entry.requiredOverride);
  const arbitration = arbitrateGovernanceDecision({
    proposedAction: action,
    trustRecommendedAction: trustGate.recommendedAction,
    shadowModeActive,
    trustRegime: trustSummary.trustRegime,
    trustMomentum: trustSummary.trustMomentum,
    notificationPressureState,
    permissionBoundary,
    rollbackPrediction,
    autonomyConfidence,
    operationalMode: deploymentSafetyConfig?.operationalMode,
    recentRollbackAt: mostRecentOverride?.timestamp ?? null,
    suppressCriticalContinuityEvents: false,
  });

  const effectiveAction = arbitration.resolvedAction;
  const invariants = arbitration.invariants;

  for (const violation of invariants.violations) {
    await appendInvariantAuditEntry({
      invariantId: violation.id,
      userId: resolvedUserId,
      blockedAction: action,
      severity: violation.severity,
      context: {
        originalAction: action,
        effectiveAction,
        trustRegime: trustSummary.trustRegime,
        trustMomentum: trustSummary.trustMomentum,
        autonomyTier: autonomyProfile.tier,
        autonomyBoundary: permissionBoundary.stage,
        rollbackProbability: rollbackPrediction.rollbackProbability,
        trustDisruptionProbability: rollbackPrediction.trustDisruptionProbability,
        interruptionCost: rollbackPrediction.interruptionCost,
        authorityLevel: autonomyConfidence.authorityLevel,
        decisionConfidence: autonomyConfidence.decisionConfidence,
      },
      downstreamActionTaken: invariants.enforcedAction,
    }).catch(() => null);
  }

  await appendDecisionProvenance({
    userId: resolvedUserId,
    action: effectiveAction,
    originatingSignals: {
      state,
      pressureState: notificationPressureState,
      trustRegime: trustSummary.trustRegime,
    },
    trustInputs: {
      continuityTrustScore: trustGate.metrics.continuityTrustScore,
      pacingRespectScore: trustGate.metrics.pacingRespectScore,
      adaptiveComfortIndex: trustGate.metrics.adaptiveComfortIndex,
      trustMomentum: trustSummary.trustMomentum,
    },
    fatigueInputs: {
      sessionHesitationRate: trustGate.signals.sessionHesitationRate,
      reductionRequestRate: trustGate.signals.reductionRequestRate,
      interruptionCost: rollbackPrediction.interruptionCost,
    },
    personalizationFactors: {
      autonomyTier: autonomyProfile.tier,
      adaptationAcceptance: interventionAcceptance.acceptanceScore,
      recoveryResponsiveness: recoveryEffectiveness.overallResponsiveness,
    },
    rolloutPosture: {
      operationalMode: deploymentSafetyConfig?.operationalMode ?? "regulated_autonomy",
      shadowModeActive,
      trustRegime: trustSummary.trustRegime,
    },
    invariantChecks: invariants.violations.map((violation) => ({
      id: violation.id,
      passed: false,
      detail: violation.message,
    })),
    rejectedAlternatives: [
      {
        action,
        reason: effectiveAction !== action ? "adjusted by trust, confidence, rollout mode, or invariants" : "selected",
      },
    ],
    confidenceScore: autonomyConfidence.decisionConfidence,
    shadowComparison: {
      shadowDecision: trustGate.recommendedAction,
      liveDecision: effectiveAction,
      diverged: trustGate.recommendedAction !== effectiveAction,
    },
    finalAuthoritySource: toProvenanceAuthoritySource(arbitration.finalAuthoritySource),
  }).catch(() => null);

  console.log("ACTION:", action, "EFFECTIVE_ACTION:", effectiveAction, "TRUST_REGIME:", trustGate.trustRegime);

  if (shadowModeActive) {
    await appendShadowModeDecision({
      userId: resolvedUserId,
      decision: JSON.stringify({ wouldApply: trustGate.recommendedAction, observedAction: action }),
      confidence: trustGate.metrics.continuityTrustScore,
      expectedBenefit: {
        expectedFatigueReduction: Math.max(0, 1 - trustGate.metrics.pacingRespectScore),
        expectedTrustStabilityGain: Math.max(0, 1 - trustGate.metrics.adaptiveComfortIndex),
      },
      metadata: {
        state,
        trustRegime: trustGate.trustRegime,
        reasons: trustGate.reasoning,
        autonomyTier: autonomyProfile.tier,
        autonomyBoundary: permissionBoundary.stage,
        rollbackThrottle: rollbackPrediction.shouldThrottle,
        authorityLevel: autonomyConfidence.authorityLevel,
        decisionConfidence: autonomyConfidence.decisionConfidence,
      },
    });
  }

  if (effectiveAction === "awaiting_user_action") {
    const result = {
      state,
      notificationPressureState,
      action: effectiveAction,
      result: null,
      trust: {
        canUserComfortablyAbsorbThis: trustGate.canUserComfortablyAbsorbThis,
        trustRegime: trustGate.trustRegime,
        automationThrottle: trustGate.automationThrottle,
        driftAlerts: trustDriftAlerts,
        reasons: trustGate.reasoning,
        autonomy: {
          profile: summarizeAutonomyProfile(autonomyProfile),
          boundary: permissionBoundary,
          rollbackPrediction,
          confidence: autonomyConfidence,
          invariants,
          interventionAcceptance,
          recoveryEffectiveness,
        },
      },
      context: stateContext,
    };

    await appendAutonomyAcceptance(
      resolvedUserId,
      {
        timestamp: Date.now(),
        decisionType: action,
        accepted: false,
        requiredOverride: true,
        comfort: (trustGate.metrics.adaptiveComfortIndex + autonomyProfile.automationComfort) / 2,
      },
      { mutationKey: `autonomy-acceptance:${resolvedUserId}:${Date.now()}:${action}:awaiting` },
    );

    await logOrchestratorRun(resolveUserId(normalizedUser), state, effectiveAction, result.result);
    return result;
  }

  const queuedJobs = Array.isArray(normalizedUser.job_queue)
    ? normalizedUser.job_queue
        .map((job, index) => {
          const row = job as Record<string, unknown>;
          return {
            id: String(row.id || `queue-${index}`),
            title: String(row.title || "queued_job"),
            score: Number(row.score || row.intelligent_score || 0),
          };
        })
    : [];

  const intelligence = await runIntelligenceCycle({ jobs: queuedJobs }).catch(() => null);

  const reservation = await withTaskReservation(
    `orchestrator-action:${resolvedUserId}:${effectiveAction}`,
    `${resolvedUserId}:${state}:${effectiveAction}`,
    orchestratorId,
    async () => {
      return effectiveAction === "find_jobs" || effectiveAction === "send_proposals"
        ? await runRevenueLoop(normalizedUser)
        : await runTask(effectiveAction, normalizedUser as Parameters<typeof runTask>[1]);
    },
    {
      timeoutSeconds: 180,
      payload: { userId: resolvedUserId, state, action: effectiveAction },
    }
  );

  if (!reservation.reserved) {
    return {
      state,
      notificationPressureState,
      action: effectiveAction,
      result: null,
      intelligence,
      trust: {
        canUserComfortablyAbsorbThis: trustGate.canUserComfortablyAbsorbThis,
        trustRegime: trustGate.trustRegime,
        automationThrottle: trustGate.automationThrottle,
        driftAlerts: trustDriftAlerts,
        reasons: trustGate.reasoning,
        autonomy: {
          profile: summarizeAutonomyProfile(autonomyProfile),
          boundary: permissionBoundary,
          rollbackPrediction,
          confidence: autonomyConfidence,
          invariants,
          interventionAcceptance,
          recoveryEffectiveness,
        },
      },
      context: stateContext,
      skipped: true,
      reason: reservation.reason,
    };
  }

  const result = reservation.result;

  if (shadowModeActive) {
    await appendShadowModeDecision({
      userId: resolvedUserId,
      decision: JSON.stringify({
        wouldApply: trustGate.recommendedAction,
        observedAction: action,
        phase: "outcome",
      }),
      confidence: trustGate.metrics.continuityTrustScore,
      expectedBenefit: {
        expectedFatigueReduction: Math.max(0, 1 - trustGate.metrics.pacingRespectScore),
        expectedTrustStabilityGain: Math.max(0, 1 - trustGate.metrics.adaptiveComfortIndex),
      },
      actualOutcome: {
        fatigueActuallyRose: trustGate.metrics.pacingRespectScore < 0.4,
        trustActuallyDropped: trustGate.metrics.continuityTrustScore < 0.45,
      },
      metadata: {
        state,
        trustRegime: trustGate.trustRegime,
        autonomyTier: autonomyProfile.tier,
        autonomyBoundary: permissionBoundary.stage,
        authorityLevel: autonomyConfidence.authorityLevel,
        decisionConfidence: autonomyConfidence.decisionConfidence,
      },
    });
  }

  await appendAutonomyAcceptance(
    resolvedUserId,
    {
      timestamp: Date.now(),
      decisionType: action,
      accepted: trustGate.canUserComfortablyAbsorbThis,
      requiredOverride: effectiveAction !== action,
      comfort: (trustGate.metrics.adaptiveComfortIndex + autonomyProfile.automationComfort) / 2,
    },
    { mutationKey: `autonomy-acceptance:${resolvedUserId}:${Date.now()}:${action}:${effectiveAction}` },
  );

  await logOrchestratorRun(resolveUserId(normalizedUser), state, effectiveAction, result);

  return {
    state,
    notificationPressureState,
    action: effectiveAction,
    result,
    intelligence,
    trust: {
      canUserComfortablyAbsorbThis: trustGate.canUserComfortablyAbsorbThis,
      trustRegime: trustGate.trustRegime,
      automationThrottle: trustGate.automationThrottle,
      driftAlerts: trustDriftAlerts,
      reasons: trustGate.reasoning,
      autonomy: {
        profile: summarizeAutonomyProfile(autonomyProfile),
        boundary: permissionBoundary,
        rollbackPrediction,
        confidence: autonomyConfidence,
        invariants,
        interventionAcceptance,
        recoveryEffectiveness,
      },
    },
    context: stateContext,
  };
  } finally {
    await releaseLock(`orchestrator:user:${resolvedUserId}`, orchestratorId);
  }
}
