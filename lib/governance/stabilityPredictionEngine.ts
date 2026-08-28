/**
 * Phase 9D: Autonomous Stability Regulation
 * Anticipatory regulation to reduce mutation spam and governor overload.
 */

export interface StabilityPredictionInput {
  atsDriftDelta: number;
  realismScore: number;
  terminologyInflation: number;
  alignmentVolatility: number;
  recruiterSuspicionTrend: number;
  identityFragmentationPressure: number;
  governanceHealth: number;
  warningDensity: number;
  recentGovernorInterventionRate: number;
}

export interface StabilityForecast {
  safe: boolean;
  projectedRisk: number;
  expectedGovernorIntervention: number;
  projectedStabilityDelta: number;
  stabilityCoefficient: number;
  warning: string[];
}

export interface MutationCostInput {
  benefitScore: number;
  realismPenalty: number;
  credibilityPenalty: number;
  volatilityPenalty: number;
}

export interface MutationCostScore {
  benefitScore: number;
  mutationCost: number;
  costToBenefitRatio: number;
  approved: boolean;
}

export interface RecursiveMemoryWeightInput {
  baseWeight: number;
  cyclesAgo: number;
  unstableMutationPenalty: number;
  instabilityPressure: number;
}

export interface SelfCalmingInput {
  warningDensity: number;
  realismScore: number;
  alignmentScore: number;
  governanceHealth: number;
}

export interface SelfCalmingResult {
  systemMode: "normal" | "stabilization";
  optimizationFrequencyMultiplier: number;
  freezeAtsExperimentation: boolean;
  varianceNarrowingFactor: number;
  terminologySpreadLimit: number;
  cooldownWindowsEnforced: boolean;
}

export interface RecoveryState {
  volatility: number;
  realismScore: number;
  trustScore: number;
  adaptationIntensity: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Predictive Stability Awareness
 */
export function predictMutationStability(input: StabilityPredictionInput): StabilityForecast {
  const realismRisk = clamp01(1 - input.realismScore);
  const atsRisk = clamp01(input.atsDriftDelta / 0.1);
  const terminologyRisk = clamp01(input.terminologyInflation);
  const alignmentRisk = clamp01(input.alignmentVolatility);
  const suspicionRisk = clamp01(input.recruiterSuspicionTrend);
  const identityRisk = clamp01(input.identityFragmentationPressure);
  const governanceRisk = clamp01(1 - input.governanceHealth);
  const warningRisk = clamp01(input.warningDensity);
  const interventionRisk = clamp01(input.recentGovernorInterventionRate);

  const projectedRisk = clamp01(
    realismRisk * 0.22 +
      atsRisk * 0.12 +
      terminologyRisk * 0.1 +
      alignmentRisk * 0.14 +
      suspicionRisk * 0.14 +
      identityRisk * 0.12 +
      governanceRisk * 0.1 +
      warningRisk * 0.04 +
      interventionRisk * 0.02
  );

  const projectedStabilityDelta = clamp01(1 - projectedRisk);
  const expectedGovernorIntervention = clamp01(projectedRisk * 0.85 + warningRisk * 0.15);

  const stabilityCoefficient = clamp01(
    input.realismScore *
      (1 - input.alignmentVolatility * 0.5) *
      input.governanceHealth *
      (1 - input.identityFragmentationPressure * 0.4)
  );

  const warning: string[] = [];
  if (projectedRisk > 0.6) warning.push("High projected destabilization risk");
  if (expectedGovernorIntervention > 0.55) warning.push("Expected governor intervention is elevated");
  if (stabilityCoefficient < 0.4) warning.push("Low stability coefficient will weaken safe mutation power");

  return {
    safe: projectedRisk < 0.55 && expectedGovernorIntervention < 0.6,
    projectedRisk,
    expectedGovernorIntervention,
    projectedStabilityDelta,
    stabilityCoefficient,
    warning,
  };
}

/**
 * Mutation Cost Scoring
 */
export function scoreMutationCost(input: MutationCostInput): MutationCostScore {
  const mutationCost =
    clamp01(input.realismPenalty) + clamp01(input.credibilityPenalty) + clamp01(input.volatilityPenalty);
  const benefitScore = clamp01(input.benefitScore);

  return {
    benefitScore,
    mutationCost,
    costToBenefitRatio: mutationCost / Math.max(0.01, benefitScore),
    approved: mutationCost <= benefitScore,
  };
}

/**
 * Recursive Memory Weighting
 */
export function applyRecursiveMemoryWeight(input: RecursiveMemoryWeightInput): number {
  const ageDecay = Math.pow(0.95, Math.max(0, input.cyclesAgo));
  const instabilityPenalty = clamp01(input.unstableMutationPenalty * 0.7 + input.instabilityPressure * 0.3);
  const weighted = input.baseWeight * ageDecay * (1 - instabilityPenalty);

  return Math.max(0.01, Number(weighted.toFixed(4)));
}

/**
 * Adaptive Friction Layer
 */
export function computeEffectiveMutationPower(
  baseMutationPower: number,
  realismScore: number,
  alignmentScore: number,
  governanceHealth: number
): { stabilityCoefficient: number; effectiveMutationPower: number } {
  const stabilityCoefficient = clamp01(realismScore * alignmentScore * governanceHealth);
  return {
    stabilityCoefficient,
    effectiveMutationPower: Number((baseMutationPower * stabilityCoefficient).toFixed(4)),
  };
}

/**
 * Recursive Self-Calming
 */
export function evaluateSelfCalming(input: SelfCalmingInput): SelfCalmingResult {
  const pressure = clamp01(
    input.warningDensity * 0.45 +
      (1 - input.realismScore) * 0.2 +
      (1 - input.alignmentScore) * 0.2 +
      (1 - input.governanceHealth) * 0.15
  );

  if (pressure > 0.55) {
    return {
      systemMode: "stabilization",
      optimizationFrequencyMultiplier: 0.4,
      freezeAtsExperimentation: true,
      varianceNarrowingFactor: 0.5,
      terminologySpreadLimit: 3,
      cooldownWindowsEnforced: true,
    };
  }

  return {
    systemMode: "normal",
    optimizationFrequencyMultiplier: 1,
    freezeAtsExperimentation: false,
    varianceNarrowingFactor: 1,
    terminologySpreadLimit: 8,
    cooldownWindowsEnforced: false,
  };
}

/**
 * Recursive Health Recovery
 */
export function recoverTowardBaseline(state: RecoveryState): RecoveryState {
  return {
    volatility: Number(Math.max(0.05, state.volatility * 0.9).toFixed(4)),
    realismScore: Number(Math.min(1, state.realismScore + 0.04).toFixed(4)),
    trustScore: Number(Math.min(1, state.trustScore + 0.03).toFixed(4)),
    adaptationIntensity: Number(Math.max(0.2, state.adaptationIntensity * 0.85).toFixed(4)),
  };
}

export function calculateStabilityEfficiencyRatio(
  successfulMutations: number,
  governorInterventions: number
): number {
  if (governorInterventions <= 0) {
    return successfulMutations > 0 ? successfulMutations : 0;
  }
  return Number((successfulMutations / governorInterventions).toFixed(4));
}
