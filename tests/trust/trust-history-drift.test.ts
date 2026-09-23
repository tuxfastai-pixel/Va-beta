import { test } from "node:test"
import assert from "node:assert"
import {
  appendAutonomyAcceptance,
  appendInterventionEffect,
  appendRecoveryOutcome,
  appendTrustTransition,
  appendTrustWindow,
  loadTrustHistoryRecord,
  summarizeTrustHistory,
} from "../../lib/trust/trustHistoryStore.ts"
import { detectTrustDrift } from "../../lib/trust/trustDriftEngine.ts"
import { evaluateOrchestrationTrustGate } from "../../lib/trust/trustOrchestrationGate.ts"
import { computeTrustMetrics } from "../../lib/trust/trustMetrics.ts"
import type { TrustMetricSignals } from "../../lib/trust/trustMetrics.ts"

function buildSignals(overrides: Partial<TrustMetricSignals> = {}): TrustMetricSignals {
  return {
    recoveryAcceptanceRate: 0.8,
    resumeAbandonmentRate: 0.1,
    repeatedRestartRate: 0.08,
    sessionHesitationRate: 0.12,
    notificationDismissalRate: 0.15,
    modeOverrideRate: 0.11,
    rapidUiExitRate: 0.12,
    reductionRequestRate: 0.15,
    rollbackFrequencyRate: 0.08,
    trustDecayRate: 0.1,
    oscillationExposureRate: 0.1,
    recoverySuccessRate: 0.85,
    interventionHelpfulRate: 0.82,
    interventionControllingRate: 0.18,
    interventionProtectiveRate: 0.79,
    interventionFrustratingRate: 0.14,
    automationComfortRate: 0.75,
    adaptationComfortRate: 0.74,
    orchestrationComfortRate: 0.72,
    autonomousPacingComfortRate: 0.73,
    ...overrides,
  }
}

test("Trust history store persists windows/transitions and provides summaries", async () => {
  const userId = `trust-history-${Date.now().toString(16)}`
  const now = Date.now()
  const signals = buildSignals()

  await appendTrustWindow(
    userId,
    {
      timestamp: now,
      metrics: computeTrustMetrics(signals, now),
      signals,
      source: "test_seed",
    },
    { mutationKey: `${userId}:window:1` },
  )

  await appendTrustTransition(
    userId,
    {
      timestamp: now,
      previousRegime: "balanced",
      nextRegime: "progressive",
      reason: "trust remained strong",
    },
    { mutationKey: `${userId}:transition:1` },
  )

  const record = await loadTrustHistoryRecord(userId)
  const summary = summarizeTrustHistory(record)

  assert.equal(record.trustWindows.length, 1)
  assert.equal(record.transitions.length, 1)
  assert.equal(summary.trustRegime, "progressive")
  assert(summary.latestMetrics)
  assert(summary.latestMetrics!.compositeTrustScore > 0.6)
})

test("Trust drift engine catches erosion and intervention rejection patterns", async () => {
  const userId = `trust-drift-${Date.now().toString(16)}`
  const now = Date.now()

  for (let index = 0; index < 8; index += 1) {
    const trustDrop = 0.18 + index * 0.08
    const signals = buildSignals({
      recoveryAcceptanceRate: Math.max(0.1, 0.65 - trustDrop),
      resumeAbandonmentRate: Math.min(0.95, 0.25 + trustDrop),
      modeOverrideRate: Math.min(0.95, 0.2 + trustDrop),
      reductionRequestRate: Math.min(0.95, 0.18 + trustDrop),
      trustDecayRate: Math.min(0.95, 0.2 + trustDrop),
      interventionHelpfulRate: Math.max(0.1, 0.75 - trustDrop),
      interventionControllingRate: Math.min(0.95, 0.15 + trustDrop),
      interventionFrustratingRate: Math.min(0.95, 0.2 + trustDrop),
      automationComfortRate: Math.max(0.1, 0.7 - trustDrop),
      adaptationComfortRate: Math.max(0.1, 0.7 - trustDrop),
      orchestrationComfortRate: Math.max(0.1, 0.68 - trustDrop),
      autonomousPacingComfortRate: Math.max(0.1, 0.7 - trustDrop),
    })

    const timestamp = now + index * 60_000
    await appendTrustWindow(
      userId,
      {
        timestamp,
        metrics: computeTrustMetrics(signals, timestamp),
        signals,
        source: "drift_test",
      },
      { mutationKey: `${userId}:window:${index}` },
    )

    await appendInterventionEffect(
      userId,
      {
        timestamp,
        interventionType: "stabilization",
        accepted: index < 2,
        perceivedSupport: Math.max(0.1, 0.68 - index * 0.09),
      },
      { mutationKey: `${userId}:intervention:${index}` },
    )

    await appendRecoveryOutcome(
      userId,
      {
        timestamp,
        strategy: "guided_reentry",
        successful: index < 2,
        userConfidence: Math.max(0.1, 0.72 - index * 0.08),
      },
      { mutationKey: `${userId}:recovery:${index}` },
    )

    await appendAutonomyAcceptance(
      userId,
      {
        timestamp,
        decisionType: "automation",
        accepted: index < 3,
        requiredOverride: index >= 2,
        comfort: Math.max(0.1, 0.7 - index * 0.08),
      },
      { mutationKey: `${userId}:autonomy:${index}` },
    )
  }

  const record = await loadTrustHistoryRecord(userId)
  const alerts = detectTrustDrift(record, now + 15 * 60_000)

  const kinds = new Set(alerts.map((alert) => alert.kind))
  assert(kinds.has("gradual_trust_erosion"))
  assert(kinds.has("intervention_rejection"))
  assert(kinds.has("autonomy_discomfort_spike"))
})

test("Orchestration trust gate reduces autonomy under high trust drift", async () => {
  const userId = `trust-gate-${Date.now().toString(16)}`
  const now = Date.now()

  const weakSignals = buildSignals({
    recoveryAcceptanceRate: 0.2,
    resumeAbandonmentRate: 0.85,
    repeatedRestartRate: 0.8,
    sessionHesitationRate: 0.82,
    notificationDismissalRate: 0.88,
    modeOverrideRate: 0.84,
    rapidUiExitRate: 0.83,
    reductionRequestRate: 0.87,
    rollbackFrequencyRate: 0.8,
    trustDecayRate: 0.84,
    oscillationExposureRate: 0.8,
    recoverySuccessRate: 0.2,
    interventionHelpfulRate: 0.2,
    interventionControllingRate: 0.83,
    interventionProtectiveRate: 0.25,
    interventionFrustratingRate: 0.85,
    automationComfortRate: 0.15,
    adaptationComfortRate: 0.18,
    orchestrationComfortRate: 0.2,
    autonomousPacingComfortRate: 0.16,
  })

  await appendTrustWindow(
    userId,
    {
      timestamp: now,
      metrics: computeTrustMetrics(weakSignals, now),
      signals: weakSignals,
      source: "gate_test",
    },
    { mutationKey: `${userId}:window` },
  )

  const record = await loadTrustHistoryRecord(userId)
  const decision = evaluateOrchestrationTrustGate({
    action: "send_proposals",
    record,
    driftAlerts: [
      {
        id: `${userId}:high-drift`,
        timestamp: now,
        kind: "gradual_trust_erosion",
        severity: "high",
        description: "trust dropped rapidly",
        evidence: { drop: 0.42 },
      },
    ],
  })

  assert.equal(decision.canUserComfortablyAbsorbThis, false)
  assert.equal(decision.trustRegime, "guarded")
  assert.equal(decision.recommendedAction, "manual_review_required")
})
