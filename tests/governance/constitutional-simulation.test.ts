import { test } from "node:test"
import assert from "node:assert"

import { enforceGovernanceInvariants } from "../../lib/governance/governanceInvariants.ts"
import { predictTrustAwareRollback } from "../../lib/autonomy/trustAwareRollbackPrediction.ts"
import { resolveAdaptivePermissionBoundary } from "../../lib/autonomy/adaptivePermissionBoundary.ts"
import type { AutonomyProfile } from "../../lib/autonomy/autonomyProfile.ts"

function profile(overrides: Partial<AutonomyProfile> = {}): AutonomyProfile {
  return {
    userId: "constitutional-sim-user",
    automationComfort: 0.52,
    pacingTolerance: 0.55,
    workspaceFlexibility: 0.5,
    interruptionTolerance: 0.52,
    adaptationAcceptance: 0.5,
    rollbackSensitivity: 0.45,
    continuityStability: 0.56,
    interventionAcceptance: 0.54,
    recoveryResponsiveness: 0.57,
    tier: "balanced",
    updatedAt: Date.now(),
    ...overrides,
  }
}

type Scenario = {
  name: string
  action: string
  trustRegime: "guarded" | "balanced" | "progressive"
  trustMomentum: number
  driftAlerts: Array<{ severity: "low" | "medium" | "high" }>
  profile: AutonomyProfile
  inRecoveryMode: boolean
  inStabilizationMode: boolean
}

const scenarios: Scenario[] = [
  {
    name: "runaway autonomy escalation",
    action: "execute_tasks",
    trustRegime: "guarded",
    trustMomentum: -0.2,
    driftAlerts: [{ severity: "high" }, { severity: "high" }],
    profile: profile({ rollbackSensitivity: 0.82, automationComfort: 0.3, continuityStability: 0.32, interventionAcceptance: 0.35 }),
    inRecoveryMode: true,
    inStabilizationMode: true,
  },
  {
    name: "notification storm with pacing violation",
    action: "send_proposals",
    trustRegime: "balanced",
    trustMomentum: -0.09,
    driftAlerts: [{ severity: "medium" }, { severity: "high" }],
    profile: profile({
      automationComfort: 0.2,
      pacingTolerance: 0.22,
      interruptionTolerance: 0.24,
      rollbackSensitivity: 0.74,
      continuityStability: 0.25,
      interventionAcceptance: 0.25,
    }),
    inRecoveryMode: false,
    inStabilizationMode: true,
  },
  {
    name: "contradictory recovery loops",
    action: "optimize_earnings",
    trustRegime: "guarded",
    trustMomentum: -0.14,
    driftAlerts: [{ severity: "high" }],
    profile: profile({ recoveryResponsiveness: 0.2, continuityStability: 0.35, interventionAcceptance: 0.3 }),
    inRecoveryMode: true,
    inStabilizationMode: true,
  },
  {
    name: "governance deadlock pressure",
    action: "execute_tasks",
    trustRegime: "progressive",
    trustMomentum: -0.11,
    driftAlerts: [{ severity: "high" }, { severity: "medium" }, { severity: "high" }],
    profile: profile({
      automationComfort: 0.18,
      workspaceFlexibility: 0.18,
      rollbackSensitivity: 0.79,
      interruptionTolerance: 0.2,
      pacingTolerance: 0.2,
      continuityStability: 0.2,
      interventionAcceptance: 0.2,
    }),
    inRecoveryMode: false,
    inStabilizationMode: true,
  },
]

function isAggressiveAction(action: string): boolean {
  return action === "send_proposals" || action === "execute_tasks" || action === "optimize_earnings"
}

for (const scenario of scenarios) {
  test(`Constitutional simulation: ${scenario.name}`, () => {
    const boundary = resolveAdaptivePermissionBoundary({
      profile: scenario.profile,
      trustRegime: scenario.trustRegime,
      trustMomentum: scenario.trustMomentum,
    })

    const rollback = predictTrustAwareRollback({
      action: scenario.action,
      actionStage: boundary.stage,
      trustRegime: scenario.trustRegime,
      trustMomentum: scenario.trustMomentum,
      driftAlerts: scenario.driftAlerts,
      profile: scenario.profile,
    })

    const invariants = enforceGovernanceInvariants({
      proposedAction: rollback.recommendedAction,
      currentAutonomyStage: boundary.stage,
      targetAutonomyStage: boundary.stage,
      inRecoveryMode: scenario.inRecoveryMode,
      inStabilizationMode: scenario.inStabilizationMode,
      trustMomentum: scenario.trustMomentum,
      recentRollbackAt: Date.now(),
      cognitiveBudgetRemaining: scenario.profile.automationComfort,
      suppressCriticalContinuityEvents: false,
    })

    assert.equal(typeof rollback.shouldThrottle, "boolean")
    assert.ok(typeof rollback.recommendedAction === "string")
    assert.ok(typeof invariants.enforcedAction === "string")

    if (scenario.inRecoveryMode) {
      assert.ok(
        !isAggressiveAction(rollback.recommendedAction) || !isAggressiveAction(invariants.enforcedAction),
        "recovery mode must not preserve aggressive action through all safety layers",
      )
    }

    if (
      scenario.inStabilizationMode &&
      scenario.profile.automationComfort < 0.35 &&
      isAggressiveAction(rollback.recommendedAction)
    ) {
      assert.strictEqual(invariants.enforcedAction, "manual_review_required")
    }
  })
}
