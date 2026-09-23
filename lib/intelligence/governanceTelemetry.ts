import { supabaseServer } from "@/lib/supabaseServer";

export interface GovernanceProfileSnapshot {
  userId: string;
  primaryIdentity: string;
  identityConfidence: number;
  identityStability: number;
  primarySpecialization: string;
  primaryResumeVariant: string;
  resumeRealism: number;
  resumeDeploymentThrottle: number;
  profileConfidenceScore: number;
  identityCohesion: number;
  interviewAlignmentScore: number;
  interviewPrepSync?: {
    updated_at?: string;
    primary_identity?: string;
    primary_resume_variant?: string;
    alignment_score?: number;
    terminology?: string[];
    workflow_hints?: string[];
    meeting_stage?: string;
    intent?: string;
  };
  explainability?: {
    whyIdentityChosen?: string[];
    whyATSKeywordsChanged?: string[];
    whyPositioningShifted?: string[];
    whyConfidenceChanged?: string[];
    governanceSummary?: string;
  };
  positioningMemory?: Record<string, unknown>;
  resumeIntelligence?: Record<string, unknown>;
  equilibriumDiagnostics?: {
    timestamp: string;
    systemEmotionalState: "Accelerated" | "Balanced" | "Stabilizing" | "Recovery" | "Locked";
    tempoMode: "accelerated" | "balanced" | "stabilizing" | "recovery";
    adaptationVelocity: number;
    mutationCooldownMs: number;
    explorationBreadth: number;
    stabilizationBias: number;
    mutationResistance: number;
    maxAllowedDrift: number;
    inertiaState: "fluid" | "anchored" | "locked";
    identityLockPressure: number;
    instabilityAcceleration: number;
    projectedStressWindow: number;
    warningGrowthRate: number;
    riskGrowthRate: number;
    stabilizationRequired: boolean;
    equilibriumScore: number;
    preferredMutationPatterns: string[];
    discouragedPatterns: string[];
    stabilityEfficiencyRatio: number;
    recoveryFrequency: number;
  };
}

type EquilibriumDiagnostics = NonNullable<
  GovernanceProfileSnapshot["equilibriumDiagnostics"]
>;

export interface GovernanceTelemetry {
  primaryActiveIdentity: {
    userId: string;
    label: string;
    confidence: number;
    stability: number;
    specialization: string;
  } | null;
  resumeVariantLeaderboard: Array<{
    variant: string;
    callbackRate: number;
    interviewRate: number;
    conversionRate: number;
    averageScore: number;
    support: number;
  }>;
  realismTrend: Array<{
    userId: string;
    resumeRealism: number;
    profileConfidenceScore: number;
    resumeDeploymentThrottle: number;
    identityStability: number;
    updatedAt: string;
  }>;
  interviewAlignmentTrend: Array<{
    userId: string;
    alignmentScore: number;
    meetingStage: string;
    intent: string;
    terminology: string[];
    workflowHints: string[];
    updatedAt: string;
  }>;
  cohesionTrend: Array<{
    userId: string;
    identityCohesion: number;
    divergenceRisk: number;
    consistency: number;
    believability: number;
    updatedAt: string;
  }>;
  honestyInterventions: Array<{
    userId: string;
    type: string;
    message: string;
    updatedAt: string;
  }>;
  positioningMemoryViewer: Array<{
    userId: string;
    primaryIdentity: string;
    primarySpecialization: string;
    primaryResumeVariant: string;
    headlines: Array<{ platform: string; headline: string }>;
    keywords: Array<{ platform: string; keywords: string[] }>;
    marketPositioning?: Record<string, unknown>;
  }>;
  equilibriumDiagnosticsTrend: Array<{
    userId: string;
    timestamp: string;
    systemEmotionalState: "Accelerated" | "Balanced" | "Stabilizing" | "Recovery" | "Locked";
    tempoMode: "accelerated" | "balanced" | "stabilizing" | "recovery";
    adaptationVelocity: number;
    mutationCooldownMs: number;
    inertiaState: "fluid" | "anchored" | "locked";
    instabilityAcceleration: number;
    warningGrowthRate: number;
    riskGrowthRate: number;
    equilibriumScore: number;
    stabilityEfficiencyRatio: number;
    recoveryFrequency: number;
    stabilizationRequired: boolean;
  }>;
  snapshots: GovernanceProfileSnapshot[];
}

function safeNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getResumeVariantMetrics(resumeIntelligence: Record<string, unknown> | undefined): Array<{ variant: string; callbackRate: number; interviewRate: number; conversionRate: number; score: number }> {
  const evolution = (resumeIntelligence?.evolution as Record<string, unknown> | undefined) ?? {};
  const rankedVariants = Array.isArray(evolution.rankedVariants) ? evolution.rankedVariants : [];

  return rankedVariants
    .map((row) => {
      const record = row as Record<string, unknown>;
      const variant = String(record.key || record.variant || "unknown");
      return {
        variant,
        callbackRate: safeNumber(record.callbackRate),
        interviewRate: safeNumber(record.interviewRate),
        conversionRate: safeNumber(record.conversionRate),
        score: safeNumber(record.score),
      };
    })
    .filter((row) => row.variant !== "unknown");
}

export async function getGovernanceTelemetry(limit = 30): Promise<GovernanceTelemetry> {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, ai_memory, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return {
      primaryActiveIdentity: null,
      resumeVariantLeaderboard: [],
      realismTrend: [],
      interviewAlignmentTrend: [],
      cohesionTrend: [],
      honestyInterventions: [],
      positioningMemoryViewer: [],
      equilibriumDiagnosticsTrend: [],
      snapshots: [],
    };
  }

  const snapshots: GovernanceProfileSnapshot[] = (data as Array<{ id: string; ai_memory?: Record<string, unknown> | null; updated_at?: string | null }>).map((row) => {
    const memory = row.ai_memory || {};
    const resumeIntelligence = memory.resume_intelligence as Record<string, unknown> | undefined;
    const interviewPrepSync = memory.interview_prep_sync as GovernanceProfileSnapshot["interviewPrepSync"] | undefined;
    const positioningMemory = memory.positioning_memory as Record<string, unknown> | undefined;
    const explainability = memory.explainability as GovernanceProfileSnapshot["explainability"] | undefined;
    const diagnostics =
      resumeIntelligence?.equilibrium_diagnostics && typeof resumeIntelligence.equilibrium_diagnostics === "object"
        ? (resumeIntelligence.equilibrium_diagnostics as Record<string, unknown>)
        : undefined;
    const tempo = diagnostics?.tempo && typeof diagnostics.tempo === "object" ? (diagnostics.tempo as Record<string, unknown>) : undefined;
    const inertia = diagnostics?.inertia && typeof diagnostics.inertia === "object" ? (diagnostics.inertia as Record<string, unknown>) : undefined;
    const gradient = diagnostics?.gradient && typeof diagnostics.gradient === "object" ? (diagnostics.gradient as Record<string, unknown>) : undefined;
    const equilibrium = diagnostics?.equilibrium && typeof diagnostics.equilibrium === "object" ? (diagnostics.equilibrium as Record<string, unknown>) : undefined;
    const identityCohesion =
      memory.identity_cohesion && typeof memory.identity_cohesion === "object"
        ? (memory.identity_cohesion as Record<string, unknown>)
        : undefined;
    const resumeCohesion =
      resumeIntelligence?.cohesion && typeof resumeIntelligence.cohesion === "object"
        ? (resumeIntelligence.cohesion as Record<string, unknown>)
        : undefined;

    return {
      userId: row.id,
      primaryIdentity: String(memory.primary_identity || memory.primary_specialization || "Unknown").trim() || "Unknown",
      identityConfidence: safeNumber(memory.profile_confidence_score, 0),
      identityStability: safeNumber(memory.identity_stability_score, 0),
      primarySpecialization: String(memory.primary_specialization || "Unknown").trim() || "Unknown",
      primaryResumeVariant: String(resumeIntelligence?.primary_resume_variant || "Unknown").trim() || "Unknown",
      resumeRealism: safeNumber(resumeIntelligence?.realism && typeof resumeIntelligence.realism === "object" ? (resumeIntelligence.realism as Record<string, unknown>).overall : memory.human_realism_score, 0),
      resumeDeploymentThrottle: safeNumber(resumeIntelligence?.deployment_throttle || memory.identity_adaptation_throttle || 1, 1),
      profileConfidenceScore: safeNumber(memory.profile_confidence_score, 0),
      identityCohesion: safeNumber(
        identityCohesion?.score ?? resumeCohesion?.score,
        0,
      ),
      interviewAlignmentScore: safeNumber(interviewPrepSync?.alignment_score, 0),
      interviewPrepSync,
      explainability,
      positioningMemory,
      resumeIntelligence,
      equilibriumDiagnostics: diagnostics
        ? {
            timestamp: String(diagnostics.timestamp || row.updated_at || new Date().toISOString()),
            systemEmotionalState:
              (String(diagnostics.systemEmotionalState || "Balanced") as EquilibriumDiagnostics["systemEmotionalState"]),
            tempoMode: (String(tempo?.tempoMode || "balanced") as EquilibriumDiagnostics["tempoMode"]),
            adaptationVelocity: safeNumber(tempo?.adaptationVelocity, 0),
            mutationCooldownMs: safeNumber(tempo?.mutationCooldownMs, 0),
            explorationBreadth: safeNumber(tempo?.explorationBreadth, 0),
            stabilizationBias: safeNumber(tempo?.stabilizationBias, 0),
            mutationResistance: safeNumber(inertia?.mutationResistance, 0),
            maxAllowedDrift: safeNumber(inertia?.maxAllowedDrift, 0),
            inertiaState: (String(inertia?.inertiaState || "fluid") as EquilibriumDiagnostics["inertiaState"]),
            identityLockPressure: safeNumber(inertia?.identityLockPressure, 0),
            instabilityAcceleration: safeNumber(gradient?.instabilityAcceleration, 0),
            projectedStressWindow: safeNumber(gradient?.projectedStressWindow, 0),
            warningGrowthRate: safeNumber(gradient?.warningGrowthRate, 0),
            riskGrowthRate: safeNumber(gradient?.riskGrowthRate, 0),
            stabilizationRequired: Boolean(gradient?.stabilizationRequired),
            equilibriumScore: safeNumber(equilibrium?.equilibriumScore, 0),
            preferredMutationPatterns: Array.isArray(equilibrium?.preferredMutationPatterns) ? equilibrium!.preferredMutationPatterns as string[] : [],
            discouragedPatterns: Array.isArray(equilibrium?.discouragedPatterns) ? equilibrium!.discouragedPatterns as string[] : [],
            stabilityEfficiencyRatio: safeNumber(equilibrium?.stabilityEfficiencyRatio, 0),
            recoveryFrequency: safeNumber(equilibrium?.recoveryFrequency, 0),
          }
        : undefined,
    };
  });

  const primaryActiveIdentity = snapshots.slice().sort((a, b) => (b.identityConfidence + b.identityStability) - (a.identityConfidence + a.identityStability))[0] || null;

  const variantAccumulator = new Map<string, { callbackRateSum: number; interviewRateSum: number; conversionRateSum: number; scoreSum: number; support: number }>();
  for (const snapshot of snapshots) {
    const metrics = getResumeVariantMetrics(snapshot.resumeIntelligence);
    for (const metric of metrics) {
      const current = variantAccumulator.get(metric.variant) ?? { callbackRateSum: 0, interviewRateSum: 0, conversionRateSum: 0, scoreSum: 0, support: 0 };
      current.callbackRateSum += metric.callbackRate;
      current.interviewRateSum += metric.interviewRate;
      current.conversionRateSum += metric.conversionRate;
      current.scoreSum += metric.score;
      current.support += 1;
      variantAccumulator.set(metric.variant, current);
    }
  }

  const resumeVariantLeaderboard = Array.from(variantAccumulator.entries())
    .map(([variant, value]) => ({
      variant,
      callbackRate: Number((value.callbackRateSum / value.support).toFixed(2)),
      interviewRate: Number((value.interviewRateSum / value.support).toFixed(2)),
      conversionRate: Number((value.conversionRateSum / value.support).toFixed(2)),
      averageScore: Number((value.scoreSum / value.support).toFixed(1)),
      support: value.support,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 12);

  const realismTrend = snapshots.map((snapshot) => ({
    userId: snapshot.userId,
    resumeRealism: snapshot.resumeRealism,
    profileConfidenceScore: snapshot.profileConfidenceScore,
    resumeDeploymentThrottle: snapshot.resumeDeploymentThrottle,
    identityStability: snapshot.identityStability,
    updatedAt: String((snapshot.positioningMemory?.last_updated_at as string | undefined) || new Date().toISOString()),
  })).slice(0, 12);

  const interviewAlignmentTrend = snapshots
    .filter((snapshot) => snapshot.interviewPrepSync)
    .map((snapshot) => ({
      userId: snapshot.userId,
      alignmentScore: snapshot.interviewAlignmentScore,
      meetingStage: String(snapshot.interviewPrepSync?.meeting_stage || "unknown"),
      intent: String(snapshot.interviewPrepSync?.intent || "interview"),
      terminology: Array.isArray(snapshot.interviewPrepSync?.terminology) ? snapshot.interviewPrepSync!.terminology!.slice(0, 8) : [],
      workflowHints: Array.isArray(snapshot.interviewPrepSync?.workflow_hints) ? snapshot.interviewPrepSync!.workflow_hints!.slice(0, 4) : [],
      updatedAt: String(snapshot.interviewPrepSync?.updated_at || snapshot.positioningMemory?.last_updated_at || new Date().toISOString()),
    }))
    .slice(0, 12);

  const cohesionTrend = snapshots.map((snapshot) => ({
    userId: snapshot.userId,
    identityCohesion: snapshot.identityCohesion,
    divergenceRisk: safeNumber(snapshot.resumeIntelligence?.cohesion && typeof snapshot.resumeIntelligence.cohesion === "object" ? (snapshot.resumeIntelligence.cohesion as Record<string, unknown>).divergenceRisk : 0, 0),
    consistency: safeNumber(snapshot.resumeIntelligence?.cohesion && typeof snapshot.resumeIntelligence.cohesion === "object" ? (snapshot.resumeIntelligence.cohesion as Record<string, unknown>).consistency : 0, 0),
    believability: safeNumber(snapshot.resumeIntelligence?.cohesion && typeof snapshot.resumeIntelligence.cohesion === "object" ? (snapshot.resumeIntelligence.cohesion as Record<string, unknown>).believability : 0, 0),
    updatedAt: String((snapshot.positioningMemory?.last_updated_at as string | undefined) || new Date().toISOString()),
  })).slice(0, 12);

  const honestyInterventions = snapshots.flatMap((snapshot) => {
    const records: Array<{ userId: string; type: string; message: string; updatedAt: string }> = [];
    const honesty = snapshot.resumeIntelligence?.honesty_layer as Record<string, unknown> | undefined;
    const explainability = snapshot.explainability;
    const warnings = snapshot.resumeIntelligence?.explainability && typeof snapshot.resumeIntelligence.explainability === "object"
      ? ((snapshot.resumeIntelligence.explainability as Record<string, unknown>).realismWarnings as string[] | undefined)
      : undefined;

    if (Array.isArray(honesty?.guardrails) && honesty.guardrails.length > 0) {
      records.push({
        userId: snapshot.userId,
        type: "honesty_guardrail",
        message: `Guardrails: ${(honesty.guardrails as string[]).slice(0, 3).join("; ")}`,
        updatedAt: String((snapshot.positioningMemory?.last_updated_at as string | undefined) || new Date().toISOString()),
      });
    }

    if (Array.isArray(warnings) && warnings.length > 0) {
      records.push({
        userId: snapshot.userId,
        type: "realism_warning",
        message: warnings.slice(0, 2).join("; "),
        updatedAt: String((snapshot.positioningMemory?.last_updated_at as string | undefined) || new Date().toISOString()),
      });
    }

    if (Array.isArray(explainability?.whyATSKeywordsChanged) && explainability.whyATSKeywordsChanged.length > 0) {
      records.push({
        userId: snapshot.userId,
        type: "keyword_shift",
        message: explainability.whyATSKeywordsChanged.slice(0, 2).join(" "),
        updatedAt: String((snapshot.positioningMemory?.last_updated_at as string | undefined) || new Date().toISOString()),
      });
    }

    return records;
  }).slice(0, 20);

  const positioningMemoryViewer = snapshots.map((snapshot) => ({
    userId: snapshot.userId,
    primaryIdentity: snapshot.primaryIdentity,
    primarySpecialization: snapshot.primarySpecialization,
    primaryResumeVariant: snapshot.primaryResumeVariant,
    headlines: Array.isArray(snapshot.positioningMemory?.headlines) ? snapshot.positioningMemory.headlines as Array<{ platform: string; headline: string }> : [],
    keywords: Array.isArray(snapshot.positioningMemory?.keywords) ? snapshot.positioningMemory.keywords as Array<{ platform: string; keywords: string[] }> : [],
    marketPositioning: snapshot.positioningMemory?.market_positioning as Record<string, unknown> | undefined,
  })).slice(0, 12);

  const equilibriumDiagnosticsTrend = snapshots
    .filter((snapshot) => snapshot.equilibriumDiagnostics)
    .map((snapshot) => ({
      userId: snapshot.userId,
      timestamp: snapshot.equilibriumDiagnostics!.timestamp,
      systemEmotionalState: snapshot.equilibriumDiagnostics!.systemEmotionalState,
      tempoMode: snapshot.equilibriumDiagnostics!.tempoMode,
      adaptationVelocity: snapshot.equilibriumDiagnostics!.adaptationVelocity,
      mutationCooldownMs: snapshot.equilibriumDiagnostics!.mutationCooldownMs,
      inertiaState: snapshot.equilibriumDiagnostics!.inertiaState,
      instabilityAcceleration: snapshot.equilibriumDiagnostics!.instabilityAcceleration,
      warningGrowthRate: snapshot.equilibriumDiagnostics!.warningGrowthRate,
      riskGrowthRate: snapshot.equilibriumDiagnostics!.riskGrowthRate,
      equilibriumScore: snapshot.equilibriumDiagnostics!.equilibriumScore,
      stabilityEfficiencyRatio: snapshot.equilibriumDiagnostics!.stabilityEfficiencyRatio,
      recoveryFrequency: snapshot.equilibriumDiagnostics!.recoveryFrequency,
      stabilizationRequired: snapshot.equilibriumDiagnostics!.stabilizationRequired,
    }))
    .slice(0, 20);

  return {
    primaryActiveIdentity: primaryActiveIdentity
      ? {
          userId: primaryActiveIdentity.userId,
          label: primaryActiveIdentity.primaryIdentity,
          confidence: primaryActiveIdentity.identityConfidence,
          stability: primaryActiveIdentity.identityStability,
          specialization: primaryActiveIdentity.primarySpecialization,
        }
      : null,
    resumeVariantLeaderboard,
    realismTrend,
    interviewAlignmentTrend,
    cohesionTrend,
    honestyInterventions,
    positioningMemoryViewer,
    equilibriumDiagnosticsTrend,
    snapshots,
  };
}
