import { test } from "node:test"
import assert from "node:assert"
import { replayHumanSession } from "../../lib/replay/humanSessionReplay.ts"
import type { EquilibriumEvent } from "../../lib/telemetry/equilibriumEventStream.ts"
import type { TrustWindow } from "../../lib/trust/trustHistoryStore.ts"

function buildEvent(partial: Partial<EquilibriumEvent>): EquilibriumEvent {
  return {
    userId: "replay-user",
    timestamp: Date.now(),
    eventType: "equilibrium_transition",
    previousState: "balanced",
    nextState: "balanced",
    pressureLevel: 0.5,
    fatigueRisk: 0.4,
    recoveryTriggered: false,
    metadata: {},
    ...partial,
  }
}

test("Human replay reconstructs behavioral timeline and validates calm regulation outcomes", () => {
  const base = Date.now()
  const events: EquilibriumEvent[] = [
    buildEvent({
      timestamp: base + 2 * 60_000,
      previousState: "balanced",
      nextState: "accelerated",
      pressureLevel: 0.66,
      fatigueRisk: 0.58,
      metadata: { notificationCadence: "steady", workspaceDensity: "focused" },
    }),
    buildEvent({
      timestamp: base + 11 * 60_000,
      previousState: "accelerated",
      nextState: "stabilizing",
      pressureLevel: 0.74,
      fatigueRisk: 0.7,
      metadata: { notificationMode: "quiet", workspaceDensity: "light" },
    }),
    buildEvent({
      timestamp: base + 15 * 60_000,
      previousState: "stabilizing",
      nextState: "recovery",
      pressureLevel: 0.82,
      fatigueRisk: 0.84,
      recoveryTriggered: true,
      metadata: { notificationMode: "quiet", workspaceDensity: "light" },
    }),
    buildEvent({
      timestamp: base + 42 * 60_000,
      previousState: "recovery",
      nextState: "balanced",
      pressureLevel: 0.42,
      fatigueRisk: 0.34,
      metadata: { notificationCadence: "steady", workspaceDensity: "focused" },
    }),
  ]

  const trustWindows: TrustWindow[] = [
    {
      timestamp: base,
      source: "replay-seed",
      metrics: {
        continuityTrustScore: 0.62,
        pacingRespectScore: 0.59,
        perceivedReliability: 0.6,
        interventionSupportScore: 0.58,
        adaptiveComfortIndex: 0.57,
        compositeTrustScore: 0.6,
        computedAt: base,
      },
      signals: {
        recoveryAcceptanceRate: 0.7,
        resumeAbandonmentRate: 0.2,
        repeatedRestartRate: 0.16,
        sessionHesitationRate: 0.22,
        notificationDismissalRate: 0.2,
        modeOverrideRate: 0.24,
        rapidUiExitRate: 0.2,
        reductionRequestRate: 0.24,
        rollbackFrequencyRate: 0.12,
        trustDecayRate: 0.18,
        oscillationExposureRate: 0.16,
        recoverySuccessRate: 0.7,
        interventionHelpfulRate: 0.66,
        interventionControllingRate: 0.3,
        interventionProtectiveRate: 0.62,
        interventionFrustratingRate: 0.3,
        automationComfortRate: 0.62,
        adaptationComfortRate: 0.61,
        orchestrationComfortRate: 0.6,
        autonomousPacingComfortRate: 0.6,
      },
    },
    {
      timestamp: base + 42 * 60_000,
      source: "replay-stabilized",
      metrics: {
        continuityTrustScore: 0.74,
        pacingRespectScore: 0.78,
        perceivedReliability: 0.77,
        interventionSupportScore: 0.72,
        adaptiveComfortIndex: 0.7,
        compositeTrustScore: 0.75,
        computedAt: base + 42 * 60_000,
      },
      signals: {
        recoveryAcceptanceRate: 0.82,
        resumeAbandonmentRate: 0.08,
        repeatedRestartRate: 0.06,
        sessionHesitationRate: 0.1,
        notificationDismissalRate: 0.12,
        modeOverrideRate: 0.14,
        rapidUiExitRate: 0.11,
        reductionRequestRate: 0.1,
        rollbackFrequencyRate: 0.08,
        trustDecayRate: 0.09,
        oscillationExposureRate: 0.08,
        recoverySuccessRate: 0.84,
        interventionHelpfulRate: 0.81,
        interventionControllingRate: 0.16,
        interventionProtectiveRate: 0.79,
        interventionFrustratingRate: 0.13,
        automationComfortRate: 0.76,
        adaptationComfortRate: 0.74,
        orchestrationComfortRate: 0.73,
        autonomousPacingComfortRate: 0.75,
      },
    },
  ]

  const report = replayHumanSession({
    userId: "replay-user",
    events,
    trustWindows,
    interventions: [
      {
        id: "int-1",
        timestamp: base + 15 * 60_000,
        actor: "system",
        action: "trigger_recovery_mode",
        rationale: "overload detected",
        metadata: { userId: "replay-user" },
      },
    ],
  })

  assert.equal(report.timeline.length, 4)
  assert(report.governanceDecisionTrail.length >= 4)
  assert(report.counterfactualAnalysis.length >= 1)

  assert.equal(report.validation.notificationsDownshifted, true)
  assert.equal(report.validation.workspaceAdapted, true)
  assert.equal(report.validation.recoveryActivatedOnOverload, true)
  assert.equal(report.validation.trustNotDegraded, true)
})
