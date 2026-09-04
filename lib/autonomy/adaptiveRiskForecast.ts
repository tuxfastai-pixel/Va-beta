export type AdaptiveRiskForecastInput = {
  rollbackProbability: number
  trustDisruptionProbability: number
  interruptionCost: number
  trustMomentum: number
  trustVolatility: number
  interventionAcceptanceScore: number
  recoveryResponsiveness: number
  adaptiveComfort: number
  pacingTolerance: number
}

export type AdaptiveRiskForecast = {
  probableRollbackNextSession: number
  trustDeclineTrajectory: number
  overloadLikelihood: number
  autonomyRegressionProbability: number
  pacingInstabilityProbability: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

export function forecastAdaptiveRisk(input: AdaptiveRiskForecastInput): AdaptiveRiskForecast {
  const trustMomentumRisk = clamp01(input.trustMomentum < 0 ? Math.abs(input.trustMomentum) * 3 : 0)

  return {
    probableRollbackNextSession: clamp01(
      input.rollbackProbability * 0.5 + trustMomentumRisk * 0.16 + input.trustVolatility * 0.16 + (1 - input.interventionAcceptanceScore) * 0.18,
    ),
    trustDeclineTrajectory: clamp01(
      input.trustDisruptionProbability * 0.44 + trustMomentumRisk * 0.26 + input.trustVolatility * 0.18 + (1 - input.adaptiveComfort) * 0.12,
    ),
    overloadLikelihood: clamp01(
      input.interruptionCost * 0.4 + (1 - input.pacingTolerance) * 0.34 + (1 - input.recoveryResponsiveness) * 0.14 + input.trustVolatility * 0.12,
    ),
    autonomyRegressionProbability: clamp01(
      input.rollbackProbability * 0.3 + input.trustDisruptionProbability * 0.22 + trustMomentumRisk * 0.18 + (1 - input.adaptiveComfort) * 0.15 + (1 - input.interventionAcceptanceScore) * 0.15,
    ),
    pacingInstabilityProbability: clamp01(
      input.interruptionCost * 0.24 + (1 - input.pacingTolerance) * 0.4 + input.trustVolatility * 0.16 + (1 - input.recoveryResponsiveness) * 0.2,
    ),
  }
}
