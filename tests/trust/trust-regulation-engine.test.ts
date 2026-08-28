import { test } from "node:test"
import assert from "node:assert"
import { buildTrustRegulationPlan } from "../../lib/trust/trustRegulationEngine.ts"
import { computeTrustMetrics, type TrustMetricSignals } from "../../lib/trust/trustMetrics.ts"

function buildSignals(overrides: Partial<TrustMetricSignals> = {}): TrustMetricSignals {
  return {
    recoveryAcceptanceRate: 0.75,
    resumeAbandonmentRate: 0.1,
    repeatedRestartRate: 0.08,
    sessionHesitationRate: 0.12,

    notificationDismissalRate: 0.15,
    modeOverrideRate: 0.11,
    rapidUiExitRate: 0.09,
    reductionRequestRate: 0.1,

    rollbackFrequencyRate: 0.08,
    trustDecayRate: 0.12,
    oscillationExposureRate: 0.1,
    recoverySuccessRate: 0.82,

    interventionHelpfulRate: 0.8,
    interventionControllingRate: 0.15,
    interventionProtectiveRate: 0.78,
    interventionFrustratingRate: 0.12,

    automationComfortRate: 0.7,
    adaptationComfortRate: 0.72,
    orchestrationComfortRate: 0.68,
    autonomousPacingComfortRate: 0.7,
    ...overrides,
  }
}

test("Trust metrics convert user-behavior signals into bounded trust scores", () => {
  const metrics = computeTrustMetrics(buildSignals())

  assert(metrics.continuityTrustScore >= 0 && metrics.continuityTrustScore <= 1)
  assert(metrics.pacingRespectScore >= 0 && metrics.pacingRespectScore <= 1)
  assert(metrics.perceivedReliability >= 0 && metrics.perceivedReliability <= 1)
  assert(metrics.interventionSupportScore >= 0 && metrics.interventionSupportScore <= 1)
  assert(metrics.adaptiveComfortIndex >= 0 && metrics.adaptiveComfortIndex <= 1)
  assert(metrics.compositeTrustScore >= 0 && metrics.compositeTrustScore <= 1)
})

test("Low trust metrics force guarded autonomy and strong safety constraints", () => {
  const degraded = computeTrustMetrics(
    buildSignals({
      recoveryAcceptanceRate: 0.2,
      resumeAbandonmentRate: 0.78,
      repeatedRestartRate: 0.72,
      sessionHesitationRate: 0.8,
      notificationDismissalRate: 0.84,
      modeOverrideRate: 0.76,
      rapidUiExitRate: 0.82,
      reductionRequestRate: 0.9,
      rollbackFrequencyRate: 0.67,
      trustDecayRate: 0.79,
      oscillationExposureRate: 0.81,
      recoverySuccessRate: 0.18,
      interventionHelpfulRate: 0.2,
      interventionControllingRate: 0.8,
      interventionProtectiveRate: 0.24,
      interventionFrustratingRate: 0.88,
      automationComfortRate: 0.2,
      adaptationComfortRate: 0.25,
      orchestrationComfortRate: 0.18,
      autonomousPacingComfortRate: 0.16,
    }),
  )

  const plan = buildTrustRegulationPlan(degraded)
  assert.equal(plan.autonomyLevel, "guarded")
  assert.equal(plan.pacingIntensity, "reduced")
  assert.equal(plan.notificationPolicy, "quiet")
  assert.equal(plan.deploymentSafetyPatch.safeMode, true)
  assert.equal(plan.deploymentSafetyPatch.disableOrchestration, true)
  assert.equal(plan.deploymentSafetyPatch.disableAutonomousPacing, true)
  assert.equal(plan.rolloutPatch.mode, "recovery-only")
  assert(plan.reasons.length > 0)
})

test("Healthy trust metrics allow progressive autonomy with minimal throttling", () => {
  const healthy = computeTrustMetrics(
    buildSignals({
      recoveryAcceptanceRate: 0.94,
      resumeAbandonmentRate: 0.04,
      repeatedRestartRate: 0.03,
      sessionHesitationRate: 0.06,
      notificationDismissalRate: 0.08,
      modeOverrideRate: 0.05,
      rapidUiExitRate: 0.06,
      reductionRequestRate: 0.05,
      rollbackFrequencyRate: 0.03,
      trustDecayRate: 0.05,
      oscillationExposureRate: 0.05,
      recoverySuccessRate: 0.95,
      interventionHelpfulRate: 0.93,
      interventionControllingRate: 0.05,
      interventionProtectiveRate: 0.91,
      interventionFrustratingRate: 0.05,
      automationComfortRate: 0.9,
      adaptationComfortRate: 0.92,
      orchestrationComfortRate: 0.9,
      autonomousPacingComfortRate: 0.88,
    }),
  )

  const plan = buildTrustRegulationPlan(healthy)
  assert.equal(plan.autonomyLevel, "progressive")
  assert.equal(plan.pacingIntensity, "adaptive")
  assert.equal(plan.transparencyMode, "minimal")
  assert.equal(plan.notificationPolicy, "normal")
  assert.equal(plan.deploymentSafetyPatch.safeMode, false)
  assert.equal(plan.rolloutPatch.mode, "percentage")
  assert.equal(plan.rolloutPatch.percentage, 100)
  assert(plan.automationThrottle > 0.8)
})
