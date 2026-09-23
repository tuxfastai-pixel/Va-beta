import type { MutationDecision } from "./hardConstraintEnforcement.ts";
import type { LearningOutput } from "./equilibriumLearning.ts";

export type SystemEmotionalState = "Accelerated" | "Balanced" | "Stabilizing" | "Recovery" | "Locked";

export interface EquilibriumTelemetryInput {
  decision: MutationDecision;
  warningHistory: number[];
  riskHistory: number[];
  stabilityEfficiencyRatio: number;
  learning: LearningOutput;
  identityFragmentationRisk?: number;
  previousRecoveryFrequency?: number;
}

export interface EquilibriumDiagnosticsPayload {
  timestamp: string;
  systemEmotionalState: SystemEmotionalState;
  tempo: {
    tempoMode: "accelerated" | "balanced" | "stabilizing" | "recovery";
    adaptationVelocity: number;
    mutationCooldownMs: number;
    explorationBreadth: number;
    stabilizationBias: number;
  };
  inertia: {
    mutationResistance: number;
    maxAllowedDrift: number;
    inertiaState: "fluid" | "anchored" | "locked";
    identityLockPressure: number;
  };
  gradient: {
    instabilityAcceleration: number;
    projectedStressWindow: number;
    warningGrowthRate: number;
    riskGrowthRate: number;
    stabilizationRequired: boolean;
  };
  equilibrium: {
    equilibriumScore: number;
    preferredMutationPatterns: string[];
    discouragedPatterns: string[];
    stabilityEfficiencyRatio: number;
    recoveryFrequency: number;
  };
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function growthRate(series: number[]): number {
  if (!Array.isArray(series) || series.length < 2) {
    return 0;
  }

  const latest = Number(series[series.length - 1] ?? 0);
  const previous = series.slice(0, -1).map((value) => Number(value) || 0);
  const averagePrevious = previous.reduce((sum, value) => sum + value, 0) / Math.max(1, previous.length);
  return Number((latest - averagePrevious).toFixed(4));
}

function classifySystemState(payload: {
  tempoMode: "accelerated" | "balanced" | "stabilizing" | "recovery";
  inertiaState: "fluid" | "anchored" | "locked";
  identityLockPressure: number;
  stabilizationRequired: boolean;
}): SystemEmotionalState {
  if (payload.inertiaState === "locked" && payload.identityLockPressure >= 0.65) {
    return "Locked";
  }

  if (payload.tempoMode === "recovery") {
    return "Recovery";
  }

  if (payload.tempoMode === "stabilizing" || payload.stabilizationRequired) {
    return "Stabilizing";
  }

  if (payload.tempoMode === "accelerated" && payload.inertiaState === "fluid") {
    return "Accelerated";
  }

  return "Balanced";
}

export function buildEquilibriumDiagnosticsPayload(
  input: EquilibriumTelemetryInput
): EquilibriumDiagnosticsPayload {
  const tempo = input.decision.debugInfo.tempo;
  const inertia = input.decision.debugInfo.inertia;
  const gradient = input.decision.debugInfo.gradient;

  const warningGrowthRate = growthRate(input.warningHistory);
  const riskGrowthRate = growthRate(input.riskHistory);

  const identityFragmentationRisk = clamp01(input.identityFragmentationRisk ?? 0);
  const identityLockPressure = Number(
    clamp01(
      inertia.mutationResistance * 0.5 +
        identityFragmentationRisk * 0.35 +
        (inertia.inertiaState === "locked" ? 0.15 : 0)
    ).toFixed(4)
  );

  const isRecoveryCycle =
    tempo.mode === "recovery" ||
    (gradient.stabilizationRequired && (input.decision.mutationFrozen || !input.decision.approved));
  const previousRecoveryFrequency = clamp01(input.previousRecoveryFrequency ?? 0);
  const recoveryFrequency = Number(
    clamp01(previousRecoveryFrequency * 0.85 + (isRecoveryCycle ? 0.15 : 0)).toFixed(4)
  );

  const systemEmotionalState = classifySystemState({
    tempoMode: tempo.mode,
    inertiaState: inertia.inertiaState,
    identityLockPressure,
    stabilizationRequired: gradient.stabilizationRequired,
  });

  return {
    timestamp: new Date().toISOString(),
    systemEmotionalState,
    tempo: {
      tempoMode: tempo.mode,
      adaptationVelocity: tempo.adaptationVelocity,
      mutationCooldownMs: tempo.mutationCooldownMs,
      explorationBreadth: tempo.explorationBreadth,
      stabilizationBias: tempo.stabilizationBias,
    },
    inertia: {
      mutationResistance: inertia.mutationResistance,
      maxAllowedDrift: inertia.maxAllowedDrift,
      inertiaState: inertia.inertiaState,
      identityLockPressure,
    },
    gradient: {
      instabilityAcceleration: gradient.instabilityAcceleration,
      projectedStressWindow: gradient.projectedStressWindow,
      warningGrowthRate,
      riskGrowthRate,
      stabilizationRequired: gradient.stabilizationRequired,
    },
    equilibrium: {
      equilibriumScore: input.learning.equilibriumScore,
      preferredMutationPatterns: input.learning.preferredMutationPatterns,
      discouragedPatterns: input.learning.discouragedPatterns,
      stabilityEfficiencyRatio: Number(clamp01(input.stabilityEfficiencyRatio).toFixed(4)),
      recoveryFrequency,
    },
  };
}
