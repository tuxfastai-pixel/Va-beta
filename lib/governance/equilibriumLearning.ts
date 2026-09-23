export type LearningInputs = {
  mutationPattern: string;
  stabilityEfficiencyRatio: number;
  realismRetention: number;
  recruiterTrustDelta: number;
  governorInterventions: number;
};

export type LearningOutput = {
  preferredMutationPatterns: string[];
  discouragedPatterns: string[];
  equilibriumScore: number;
};

export type EquilibriumPatternStats = {
  attempts: number;
  cumulativeScore: number;
  averageScore: number;
  interventions: number;
};

export type EquilibriumMemoryState = {
  byPattern: Record<string, EquilibriumPatternStats>;
  equilibriumScore: number;
  preferredMutationPatterns: string[];
  discouragedPatterns: string[];
  updatedAt: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function evaluateCycleScore(input: LearningInputs): number {
  const interventionPenalty = clamp01(input.governorInterventions / 6);
  return clamp01(
    input.stabilityEfficiencyRatio * 0.35 +
      input.realismRetention * 0.3 +
      ((input.recruiterTrustDelta + 1) / 2) * 0.2 +
      (1 - interventionPenalty) * 0.15
  );
}

function safePatternState(state?: EquilibriumMemoryState): EquilibriumMemoryState {
  if (state && typeof state === "object" && state.byPattern && typeof state.byPattern === "object") {
    return {
      byPattern: state.byPattern,
      equilibriumScore: clamp01(state.equilibriumScore ?? 0.5),
      preferredMutationPatterns: Array.isArray(state.preferredMutationPatterns) ? state.preferredMutationPatterns : [],
      discouragedPatterns: Array.isArray(state.discouragedPatterns) ? state.discouragedPatterns : [],
      updatedAt: state.updatedAt || new Date().toISOString(),
    };
  }

  return {
    byPattern: {},
    equilibriumScore: 0.5,
    preferredMutationPatterns: [],
    discouragedPatterns: [],
    updatedAt: new Date().toISOString(),
  };
}

export function runEquilibriumLearning(
  input: LearningInputs,
  previousState?: EquilibriumMemoryState
): { output: LearningOutput; state: EquilibriumMemoryState } {
  const state = safePatternState(previousState);
  const pattern = input.mutationPattern.trim().toLowerCase() || "default";
  const cycleScore = evaluateCycleScore(input);

  const previousPattern = state.byPattern[pattern] ?? {
    attempts: 0,
    cumulativeScore: 0,
    averageScore: 0,
    interventions: 0,
  };

  const attempts = previousPattern.attempts + 1;
  const cumulativeScore = previousPattern.cumulativeScore + cycleScore;
  const interventions = previousPattern.interventions + Math.max(0, input.governorInterventions);
  const averageScore = Number((cumulativeScore / attempts).toFixed(4));

  const byPattern: Record<string, EquilibriumPatternStats> = {
    ...state.byPattern,
    [pattern]: {
      attempts,
      cumulativeScore: Number(cumulativeScore.toFixed(4)),
      averageScore,
      interventions,
    },
  };

  const patternEntries = Object.entries(byPattern);
  const preferredMutationPatterns = patternEntries
    .filter(([, value]) => value.attempts >= 2 && value.averageScore >= 0.62)
    .sort((a, b) => b[1].averageScore - a[1].averageScore)
    .map(([key]) => key)
    .slice(0, 6);

  const discouragedPatterns = patternEntries
    .filter(([, value]) => value.attempts >= 2 && value.averageScore <= 0.42)
    .sort((a, b) => a[1].averageScore - b[1].averageScore)
    .map(([key]) => key)
    .slice(0, 6);

  const weightedEquilibrium = patternEntries.reduce((sum, [, value]) => {
    const weight = Math.max(1, value.attempts);
    return sum + value.averageScore * weight;
  }, 0);
  const totalWeight = patternEntries.reduce((sum, [, value]) => sum + Math.max(1, value.attempts), 0) || 1;
  const equilibriumScore = Number(clamp01(weightedEquilibrium / totalWeight).toFixed(4));

  const nextState: EquilibriumMemoryState = {
    byPattern,
    equilibriumScore,
    preferredMutationPatterns,
    discouragedPatterns,
    updatedAt: new Date().toISOString(),
  };

  return {
    output: {
      preferredMutationPatterns,
      discouragedPatterns,
      equilibriumScore,
    },
    state: nextState,
  };
}
