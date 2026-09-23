export type TrustMetricSignals = {
  recoveryAcceptanceRate: number
  resumeAbandonmentRate: number
  repeatedRestartRate: number
  sessionHesitationRate: number

  notificationDismissalRate: number
  modeOverrideRate: number
  rapidUiExitRate: number
  reductionRequestRate: number

  rollbackFrequencyRate: number
  trustDecayRate: number
  oscillationExposureRate: number
  recoverySuccessRate: number

  interventionHelpfulRate: number
  interventionControllingRate: number
  interventionProtectiveRate: number
  interventionFrustratingRate: number

  automationComfortRate: number
  adaptationComfortRate: number
  orchestrationComfortRate: number
  autonomousPacingComfortRate: number
}

export type TrustMetrics = {
  continuityTrustScore: number
  pacingRespectScore: number
  perceivedReliability: number
  interventionSupportScore: number
  adaptiveComfortIndex: number
  compositeTrustScore: number
  computedAt: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function inverseRate(value: number): number {
  return 1 - clamp01(value)
}

function weightedAverage(entries: Array<{ value: number; weight: number }>): number {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
  if (totalWeight <= 0) {
    return 0
  }

  const total = entries.reduce(
    (sum, entry) => sum + clamp01(entry.value) * Math.max(0, entry.weight),
    0,
  )

  return clamp01(total / totalWeight)
}

export function computeTrustMetrics(signals: TrustMetricSignals, now = Date.now()): TrustMetrics {
  const continuityTrustScore = weightedAverage([
    { value: signals.recoveryAcceptanceRate, weight: 0.32 },
    { value: inverseRate(signals.resumeAbandonmentRate), weight: 0.26 },
    { value: inverseRate(signals.repeatedRestartRate), weight: 0.2 },
    { value: inverseRate(signals.sessionHesitationRate), weight: 0.22 },
  ])

  const pacingRespectScore = weightedAverage([
    { value: inverseRate(signals.notificationDismissalRate), weight: 0.24 },
    { value: inverseRate(signals.modeOverrideRate), weight: 0.3 },
    { value: inverseRate(signals.rapidUiExitRate), weight: 0.22 },
    { value: inverseRate(signals.reductionRequestRate), weight: 0.24 },
  ])

  const perceivedReliability = weightedAverage([
    { value: inverseRate(signals.rollbackFrequencyRate), weight: 0.28 },
    { value: inverseRate(signals.trustDecayRate), weight: 0.24 },
    { value: inverseRate(signals.oscillationExposureRate), weight: 0.2 },
    { value: signals.recoverySuccessRate, weight: 0.28 },
  ])

  const interventionSupportScore = weightedAverage([
    { value: signals.interventionHelpfulRate, weight: 0.35 },
    { value: inverseRate(signals.interventionControllingRate), weight: 0.22 },
    { value: signals.interventionProtectiveRate, weight: 0.23 },
    { value: inverseRate(signals.interventionFrustratingRate), weight: 0.2 },
  ])

  const adaptiveComfortIndex = weightedAverage([
    { value: signals.automationComfortRate, weight: 0.25 },
    { value: signals.adaptationComfortRate, weight: 0.25 },
    { value: signals.orchestrationComfortRate, weight: 0.25 },
    { value: signals.autonomousPacingComfortRate, weight: 0.25 },
  ])

  const compositeTrustScore = weightedAverage([
    { value: continuityTrustScore, weight: 0.24 },
    { value: pacingRespectScore, weight: 0.22 },
    { value: perceivedReliability, weight: 0.22 },
    { value: interventionSupportScore, weight: 0.18 },
    { value: adaptiveComfortIndex, weight: 0.14 },
  ])

  return {
    continuityTrustScore,
    pacingRespectScore,
    perceivedReliability,
    interventionSupportScore,
    adaptiveComfortIndex,
    compositeTrustScore,
    computedAt: now,
  }
}
