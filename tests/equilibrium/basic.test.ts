import { test } from "node:test"
import assert from "node:assert"
import {
  computeEquilibriumState,
} from "../../lib/governance/autonomousEquilibriumController.ts"

test("Compute equilibrium: balanced low fatigue", async () => {
  try {
    const state = computeEquilibriumState({
      pressureState: "balanced",
      fatigueInputs: {
        ignoredNotificationRate: 0.1,
        actionDelayTrend: 0.2,
        refinementLoopCount: 1,
        sessionVolatility: 0.2,
        interruptionSensitivity: 0.2,
        recoveryFrequency: 0.8,
      },
      cognitiveBudgetInputs: {
        decisionCount24h: 30,
        interactionCount1h: 5,
        contextSwitches1h: 2,
        averageTaskDepth: 1.5,
        sessionDurationMs: 30 * 60 * 1000,
        notificationIgnoreRate: 0.1,
        actionsCompleted: 8,
        actionsAbandoned: 1,
        userVelocity: 0.8,
      },
      trustContinuityInputs: {
        commitmentsStarted: 10,
        commitmentsCompleted: 9,
        commitmentsAbandoned: 1,
        sessionDaysActive: 30,
        sessionConsistency: 0.8,
        typicalSessionVariance: 0.2,
        pressureStateStability: 0.7,
        identityChanges: 0,
        directionsAbandoned: 0,
        recoverySuccessRate: 0.8,
        notificationComplianceRate: 0.8,
        consistencyTrendDays: [],
      },
      sessionDurationMs: 30 * 60 * 1000,
      completionRate: 0.89,
    })

    console.log("State:", JSON.stringify({
      pressure: state.pressureState,
      fatigue: state.fatigueRisk,
      health: state.overallHealth,
      mode: state.sessionShape.workspaceMode,
    }, null, 2))

    assert.strictEqual(state.pressureState, "balanced")
    assert(state.overallHealth > 0.7, `Health ${state.overallHealth} should be > 0.7`)
    assert(state.fatigueRisk < 0.4, `Fatigue ${state.fatigueRisk} should be < 0.4`)
  } catch (e) {
    console.error("Test error:", e)
    throw e
  }
})
