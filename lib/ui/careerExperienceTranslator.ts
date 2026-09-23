import type { AgentMemory } from "@/lib/learning/learningEngine";
import type { AiMode } from "@/lib/mode/modeManager";

export type GuidanceStateLabel =
  | "Stable and consistent"
  | "Adapting carefully"
  | "Actively refining direction"
  | "Holding steady for accuracy";

export type CareerExperienceView = {
  confidenceOfGuidance: string;
  stabilityOfDirection: string;
  momentum: string;
  systemGuidanceState: GuidanceStateLabel;
  currentState: {
    title: string;
    message: string;
  };
  nextBestAction: {
    title: string;
    actionLabel: string;
    actionKey: "refine_profile" | "prepare_interview" | "review_opportunities";
  };
  progressSignal: string;
  continuityMessage: string;
  whyThisSuggestion?: string;
  updatedAt: string;
  autoMode: {
    enabled: boolean;
    label: "Guided mode" | "Auto mode";
  };
};

type TranslatorInput = {
  memory: AgentMemory;
  mode: AiMode;
  includeWhy?: boolean;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function deriveSystemGuidanceState(memory: AgentMemory): GuidanceStateLabel {
  const state = memory.resume_intelligence?.equilibrium_diagnostics?.systemEmotionalState;
  if (state === "Recovery" || state === "Locked") return "Holding steady for accuracy";
  if (state === "Stabilizing") return "Adapting carefully";
  if (state === "Accelerated") return "Actively refining direction";
  return "Stable and consistent";
}

function deriveConfidenceTone(memory: AgentMemory): string {
  const diagnostics = memory.resume_intelligence?.equilibrium_diagnostics;
  const eq = clamp01(toNumber(diagnostics?.equilibrium?.equilibriumScore, 0.5));
  const stability = clamp01(
    toNumber(diagnostics?.equilibrium?.stabilityEfficiencyRatio, memory.mutation_policy_memory?.stability_efficiency_ratio ?? 0.5)
  );
  const interviewRisk = clamp01(toNumber(memory.interview_prep_sync?.drift?.risk_score, 0.3));
  const confidence = clamp01(eq * 0.45 + stability * 0.35 + (1 - interviewRisk) * 0.2);

  if (confidence >= 0.78) return "High confidence guidance";
  if (confidence >= 0.58) return "Strong confidence guidance";
  if (confidence >= 0.4) return "Steady confidence guidance";
  return "Building confidence through careful refinement";
}

function deriveStabilityTone(memory: AgentMemory): string {
  const driftLevel = String(memory.interview_prep_sync?.drift?.risk_level || "low").toLowerCase();
  const alignment = clamp01(toNumber(memory.interview_prep_sync?.alignment_score, 0.65));

  if (driftLevel === "critical" || driftLevel === "high") {
    return "Direction needs gentle refinement";
  }
  if (alignment >= 0.8) {
    return "Direction is highly consistent";
  }
  if (alignment >= 0.6) {
    return "Direction is stable and consistent";
  }
  return "Direction is stabilizing with small adjustments";
}

function deriveMomentumTone(memory: AgentMemory): string {
  const diagnostics = memory.resume_intelligence?.equilibrium_diagnostics;
  const velocity = clamp01(toNumber(diagnostics?.tempo?.adaptationVelocity, 0.5));
  const recovery = clamp01(
    toNumber(diagnostics?.equilibrium?.recoveryFrequency, memory.mutation_policy_memory?.recovery_frequency ?? 0)
  );

  const momentum = clamp01(velocity * 0.7 + (1 - recovery) * 0.3);
  if (momentum >= 0.75) return "Strong improvement trajectory";
  if (momentum >= 0.5) return "Progressing steadily";
  return "In a careful refinement phase";
}

function deriveCurrentStateCard(guidanceState: GuidanceStateLabel): { title: string; message: string } {
  if (guidanceState === "Holding steady for accuracy") {
    return {
      title: "Maintaining Consistency",
      message: "Your direction is being held steady to protect clarity and long-term credibility.",
    };
  }

  if (guidanceState === "Actively refining direction") {
    return {
      title: "Active Refinement",
      message: "Your positioning is improving quickly while staying aligned with your goals.",
    };
  }

  if (guidanceState === "Adapting carefully") {
    return {
      title: "Careful Alignment",
      message: "Small adjustments are being made to keep your profile consistent and interview ready.",
    };
  }

  return {
    title: "Stable Growth",
    message: "Your positioning is consistent and improving steadily over time.",
  };
}

function deriveNextBestAction(memory: AgentMemory): CareerExperienceView["nextBestAction"] {
  const interviewRecommendation = String(memory.interview_prep_sync?.drift?.recommendation || "").trim();
  if (interviewRecommendation) {
    return {
      title: "Prepare interview narrative",
      actionLabel: "Practice now",
      actionKey: "prepare_interview",
    };
  }

  const proactiveShift = String(memory.market_signal_intelligence?.recommendedProactiveShift || "").trim();
  if (proactiveShift) {
    return {
      title: `Refine role positioning for ${proactiveShift.replace(/_/g, " ")}`,
      actionLabel: "Refine now",
      actionKey: "refine_profile",
    };
  }

  return {
    title: "Add one measurable project outcome",
    actionLabel: "Update profile",
    actionKey: "refine_profile",
  };
}

function deriveContinuityMessage(memory: AgentMemory): string {
  const history = memory.positioning_memory?.history || [];
  const recent = history.at(-1);
  const previous = history.at(-2);

  if (recent?.primary_identity && previous?.primary_identity && recent.primary_identity === previous.primary_identity) {
    return "We are continuing from your previous direction and keeping your positioning consistent.";
  }

  if (recent?.primary_specialization) {
    return `This aligns with your recent positioning around ${recent.primary_specialization}.`;
  }

  return "We are maintaining consistency with your interview and profile direction.";
}

function deriveProgressSignal(memory: AgentMemory): string {
  const confidence = clamp01(toNumber(memory.profile_confidence_score, 0.5));
  const stability = clamp01(toNumber(memory.identity_stability_score, 0.5));
  const trend = confidence * 0.55 + stability * 0.45;

  if (trend >= 0.75) return "Improving consistency over time";
  if (trend >= 0.55) return "Maintaining steady progress";
  return "Building stronger direction with focused updates";
}

export function translateCareerExperience(input: TranslatorInput): CareerExperienceView {
  const guidanceState = deriveSystemGuidanceState(input.memory);
  const nextAction = deriveNextBestAction(input.memory);

  return {
    confidenceOfGuidance: deriveConfidenceTone(input.memory),
    stabilityOfDirection: deriveStabilityTone(input.memory),
    momentum: deriveMomentumTone(input.memory),
    systemGuidanceState: guidanceState,
    currentState: deriveCurrentStateCard(guidanceState),
    nextBestAction: nextAction,
    progressSignal: deriveProgressSignal(input.memory),
    continuityMessage: deriveContinuityMessage(input.memory),
    whyThisSuggestion: input.includeWhy
      ? "This suggestion reflects your recent profile updates and interview alignment patterns."
      : undefined,
    updatedAt:
      input.memory.resume_intelligence?.equilibrium_diagnostics?.timestamp ||
      input.memory.resume_intelligence?.updated_at ||
      new Date().toISOString(),
    autoMode: {
      enabled: input.mode === "autonomous",
      label: input.mode === "autonomous" ? "Auto mode" : "Guided mode",
    },
  };
}
