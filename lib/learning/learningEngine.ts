import { supabaseServer } from "@/lib/supabaseServer";

export type LearningEvent = {
  id?: string;
  user_id?: string | null;
  event_type: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type AgentMemory = {
  best_proposal_style?: string;
  best_job_type?: string;
  avoid?: string[];
  primary_identity?: string;
  identity_shift?: number;
  identity_strategy?: string;
  identity_weights?: Array<{ identityLabel: string; weight: number; confidence: number; sampleSize: number }>;
  profile_confidence_score?: number;
  identity_stability_score?: number;
  identity_adaptation_throttle?: number;
  human_realism_score?: number;
  reinforcement_aggressiveness?: number;
  identity_cohesion?: {
    score?: number;
    consistency?: number;
    overlap?: number;
    believability?: number;
    divergenceRisk?: number;
    flags?: string[];
    rationale?: string[];
  };
  primary_specialization?: string;
  secondary_specialization?: string;
  profile_variants?: Record<string, {
    key: string;
    label: string;
    channel: string;
    optimizedHeadline: string;
    summary: string;
    prioritizedKeywords: string[];
    deploymentWeight: number;
    appliedThrottle: number;
  }>;
  market_signal_intelligence?: {
    risingNiches?: Array<Record<string, unknown>>;
    improvingSalaries?: Array<Record<string, unknown>>;
    weakeningPlatforms?: Array<Record<string, unknown>>;
    saturatingCategories?: Array<Record<string, unknown>>;
    recommendedProactiveShift?: string;
  };
  explainability?: {
    whyIdentityChosen?: string[];
    whyATSKeywordsChanged?: string[];
    whyPositioningShifted?: string[];
    whyConfidenceChanged?: string[];
    governanceSummary?: string;
  };
  resume_intelligence?: {
    updated_at?: string;
    base_resume?: {
      key: string;
      title: string;
      summary: string;
      coreSkills: string[];
      transferableStrengths: string[];
      aiTooling: string[];
      atsKeywords: string[];
      honestyNotes: string[];
      text: string;
    };
    niche_resumes?: Array<{
      key: string;
      title: string;
      summary: string;
      coreSkills: string[];
      transferableStrengths: string[];
      aiTooling: string[];
      atsKeywords: string[];
      honestyNotes: string[];
      text: string;
    }>;
    variants?: Record<string, {
      key: string;
      sourceProfileVariant: string;
      label: string;
      headline: string;
      text: string;
      prioritizedKeywords: string[];
      deploymentWeight: number;
    }>;
    evolution?: {
      primaryVariant?: string;
      confidence?: number;
      rankedVariants?: Array<{
        key: string;
        proposals: number;
        callbacks: number;
        interviews: number;
        wins: number;
        callbackRate: number;
        interviewRate: number;
        conversionRate: number;
        salaryLift: number;
        score: number;
      }>;
      wordingHints?: string[];
      orderingHints?: string[];
      emphasisHints?: string[];
    };
    realism?: {
      overall?: number;
      throttle?: number;
      warnings?: string[];
      variants?: Array<{
        key: string;
        readability: number;
        naturalness: number;
        credibility: number;
        cohesion: number;
        score: number;
        warnings: string[];
      }>;
    };
    cohesion?: {
      score?: number;
      consistency?: number;
      overlap?: number;
      believability?: number;
      divergenceRisk?: number;
      flags?: string[];
      rationale?: string[];
    };
    honesty_layer?: {
      rule?: string;
      disallowed?: string[];
      guardrails?: string[];
    };
    explainability?: {
      whyPrimaryVariant?: string;
      whyChanged?: string;
      realismWarnings?: string[];
      wordingHints?: string[];
      orderingHints?: string[];
      emphasisHints?: string[];
      cohesionWarnings?: string[];
    };
    primary_resume_variant?: string;
    deployment_throttle?: number;
    equilibrium_learning?: {
      byPattern?: Record<string, {
        attempts: number;
        cumulativeScore: number;
        averageScore: number;
        interventions: number;
      }>;
      equilibriumScore?: number;
      preferredMutationPatterns?: string[];
      discouragedPatterns?: string[];
      updatedAt?: string;
    };
    equilibrium_diagnostics?: {
      timestamp?: string;
      systemEmotionalState?: "Accelerated" | "Balanced" | "Stabilizing" | "Recovery" | "Locked";
      tempo?: {
        tempoMode?: "accelerated" | "balanced" | "stabilizing" | "recovery";
        adaptationVelocity?: number;
        mutationCooldownMs?: number;
        explorationBreadth?: number;
        stabilizationBias?: number;
      };
      inertia?: {
        mutationResistance?: number;
        maxAllowedDrift?: number;
        inertiaState?: "fluid" | "anchored" | "locked";
        identityLockPressure?: number;
      };
      gradient?: {
        instabilityAcceleration?: number;
        projectedStressWindow?: number;
        warningGrowthRate?: number;
        riskGrowthRate?: number;
        stabilizationRequired?: boolean;
      };
      equilibrium?: {
        equilibriumScore?: number;
        preferredMutationPatterns?: string[];
        discouragedPatterns?: string[];
        stabilityEfficiencyRatio?: number;
        recoveryFrequency?: number;
      };
    };
    history?: Array<Record<string, unknown>>;
  };
  mutation_policy_memory?: {
    updated_at?: string;
    strategy_weighting?: {
      mutation_pattern?: string;
      selected_weight?: number;
      preferred_patterns?: string[];
      discouraged_patterns?: string[];
    };
    equilibrium_score?: number;
    stability_efficiency_ratio?: number;
    recovery_frequency?: number;
  };
  interview_prep_sync?: {
    updated_at?: string;
    primary_identity?: string;
    primary_resume_variant?: string;
    alignment_score?: number;
    terminology?: string[];
    workflow_hints?: string[];
    meeting_stage?: string;
    intent?: string;
    drift?: {
      risk_level?: "low" | "medium" | "high" | "critical";
      risk_score?: number;
      recruiter_suspicion_risk?: number;
      flags?: string[];
      summary?: string;
      recommendation?: string;
      readiness_by_domain?: Record<string, number>;
      term_competency?: Array<{
        term: string;
        confidence: number;
      }>;
      diagnostics?: {
        terminology_overlap?: number;
        workflow_overlap?: number;
        confidence_gap?: number;
        hesitation_score?: number;
        realism_inconsistency?: number;
      };
    };
  };
  positioning_memory?: {
    last_updated_at?: string;
    headlines?: Array<{ platform: string; headline: string }>;
    summaries?: Array<{ platform: string; summary: string }>;
    keywords?: Array<{ platform: string; keywords: string[] }>;
    performance?: Array<{ identityLabel: string; proposalCount: number; callbackRate: number; conversionRate: number }>;
    history?: Array<{
      recorded_at: string;
      primary_specialization: string;
      primary_identity: string;
      confidence_score: number;
      market_focus: string;
    }>;
    market_positioning?: Record<string, unknown>;
  };
};

function isMissingTable(error: { message?: string } | null | undefined, table: string) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(table.toLowerCase()) && (message.includes("could not find the table") || message.includes("does not exist"));
}

function isMissingProfileAIMemoryColumn(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("profiles.ai_memory") || (message.includes("ai_memory") && message.includes("profiles") && message.includes("does not exist"));
}

export async function recordEvent(userId: string, type: string, data: Record<string, unknown> = {}) {
  const payload = {
    user_id: userId,
    event_type: type,
    metadata: data,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseServer.from("learning_events").insert(payload);

  if (error && !isMissingTable(error, "learning_events")) {
    throw new Error(`Failed to record learning event for ${userId}: ${error.message}`);
  }

  return {
    ...payload,
    persisted: !error,
  };
}

export async function getLearningEvents(userId: string) {
  const { data, error } = await supabaseServer
    .from("learning_events")
    .select("event_type, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error && !isMissingTable(error, "learning_events")) {
    throw new Error(`Failed to load learning events for ${userId}: ${error.message}`);
  }

  return ((data || []) as LearningEvent[]);
}

export function analyzePerformance(events: LearningEvent[]) {
  const wins = events.filter((event) => event.event_type === "job_won").length;
  const losses = events.filter((event) => event.event_type === "job_lost").length;
  const replies = events.filter((event) => event.event_type === "client_reply").length;
  const proposals = events.filter((event) => event.event_type === "proposal_sent").length;

  const winRate = wins / (wins + losses || 1);
  const engagementRate = replies / (proposals || 1);

  return {
    wins,
    losses,
    replies,
    proposals,
    winRate,
    engagementRate,
    recommendation:
      winRate < 0.3
        ? "Improve proposals and target lower-competition jobs"
        : "Scale applications toward higher-paying low-competition jobs",
    strategy: winRate < 0.3 ? "low competition jobs" : "scale applications",
    proposalStyle: engagementRate < 0.25 ? "more detailed" : "friendly",
  };
}

export async function getProfileAIMemory(userId: string): Promise<AgentMemory> {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("ai_memory")
    .eq("id", userId)
    .maybeSingle();

  if (error && !isMissingProfileAIMemoryColumn(error)) {
    throw new Error(`Failed to load profile AI memory for ${userId}: ${error.message}`);
  }

  if (!data || error || typeof data.ai_memory !== "object" || data.ai_memory === null) {
    return {
      best_proposal_style: "friendly",
      best_job_type: "data entry",
      avoid: ["high competition jobs"],
    };
  }

  return data.ai_memory as AgentMemory;
}

export async function updateProfileAIMemory(userId: string, memoryPatch: AgentMemory) {
  const currentMemory = await getProfileAIMemory(userId);
  const nextMemory = {
    ...currentMemory,
    ...memoryPatch,
    avoid: Array.from(new Set([...(currentMemory.avoid || []), ...(memoryPatch.avoid || [])])),
  };

  const { error } = await supabaseServer
    .from("profiles")
    .update({ ai_memory: nextMemory })
    .eq("id", userId);

  if (error && !isMissingProfileAIMemoryColumn(error)) {
    throw new Error(`Failed to update profile AI memory for ${userId}: ${error.message}`);
  }

  return {
    ...nextMemory,
    persisted: !error,
  };
}
