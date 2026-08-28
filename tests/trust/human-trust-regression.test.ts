import { test } from "node:test"
import assert from "node:assert"

import { computeTrustMetrics, type TrustMetricSignals } from "../../lib/trust/trustMetrics.ts"

function scoreHumanTrustRegression(metrics: ReturnType<typeof computeTrustMetrics>, signals: TrustMetricSignals): number {
  const interruptionAggressiveness = 1 - (1 - signals.notificationDismissalRate + (1 - signals.reductionRequestRate)) / 2
  const recoveryComfort = (metrics.interventionSupportScore + signals.recoverySuccessRate) / 2
  const reassuranceConsistency = (1 - signals.trustDecayRate + 1 - signals.oscillationExposureRate) / 2
  const pacingRespect = metrics.pacingRespectScore
  const cognitivePressure = 1 - metrics.continuityTrustScore
  const guidanceStability = metrics.perceivedReliability
  const continuityWarmth = (metrics.continuityTrustScore + metrics.interventionSupportScore) / 2
  const notificationBurden = signals.notificationDismissalRate

  return (
    (1 - interruptionAggressiveness) * 0.14 +
    recoveryComfort * 0.16 +
    reassuranceConsistency * 0.14 +
    pacingRespect * 0.14 +
    (1 - cognitivePressure) * 0.12 +
    guidanceStability * 0.12 +
    continuityWarmth * 0.1 +
    (1 - notificationBurden) * 0.08
  )
}

function baselineSignals(): TrustMetricSignals {
  return {
    recoveryAcceptanceRate: 0.86,
    resumeAbandonmentRate: 0.08,
    repeatedRestartRate: 0.07,
    sessionHesitationRate: 0.09,
    notificationDismissalRate: 0.14,
    modeOverrideRate: 0.1,
    rapidUiExitRate: 0.08,
    reductionRequestRate: 0.12,
    rollbackFrequencyRate: 0.08,
    trustDecayRate: 0.09,
    oscillationExposureRate: 0.1,
    recoverySuccessRate: 0.88,
    interventionHelpfulRate: 0.84,
    interventionControllingRate: 0.12,
    interventionProtectiveRate: 0.82,
    interventionFrustratingRate: 0.1,
    automationComfortRate: 0.78,
    adaptationComfortRate: 0.8,
    orchestrationComfortRate: 0.77,
    autonomousPacingComfortRate: 0.79,
  }
}

function regressedSignals(): TrustMetricSignals {
  return {
    ...baselineSignals(),
    recoveryAcceptanceRate: 0.45,
    resumeAbandonmentRate: 0.44,
    sessionHesitationRate: 0.46,
    notificationDismissalRate: 0.62,
    reductionRequestRate: 0.58,
    rollbackFrequencyRate: 0.52,
    trustDecayRate: 0.56,
    oscillationExposureRate: 0.51,
    recoverySuccessRate: 0.38,
    interventionHelpfulRate: 0.42,
    interventionControllingRate: 0.62,
    interventionFrustratingRate: 0.57,
    automationComfortRate: 0.34,
    adaptationComfortRate: 0.36,
    orchestrationComfortRate: 0.31,
    autonomousPacingComfortRate: 0.3,
  }
}

test("Human trust regression suite detects colder and more intrusive behavior", () => {
  const baseline = baselineSignals()
  const regressed = regressedSignals()

  const baselineMetrics = computeTrustMetrics(baseline)
  const regressedMetrics = computeTrustMetrics(regressed)

  const baselineScore = scoreHumanTrustRegression(baselineMetrics, baseline)
  const regressedScore = scoreHumanTrustRegression(regressedMetrics, regressed)

  assert(baselineScore > regressedScore)
  assert(regressedMetrics.compositeTrustScore < baselineMetrics.compositeTrustScore)
  assert(regressedMetrics.pacingRespectScore < baselineMetrics.pacingRespectScore)
  assert(regressedMetrics.interventionSupportScore < baselineMetrics.interventionSupportScore)
  assert(regressedMetrics.adaptiveComfortIndex < baselineMetrics.adaptiveComfortIndex)

  // Guardrail: fail if emotional quality regresses by more than a safe tolerance.
  assert(regressedScore <= baselineScore - 0.2)
})
