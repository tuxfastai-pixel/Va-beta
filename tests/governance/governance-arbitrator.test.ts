import assert from "node:assert"
import { test } from "node:test"

import { arbitrateGovernanceDecision } from "../../lib/governance/governanceArbitrator.ts"
import type { AdaptivePermissionBoundary } from "../../lib/autonomy/adaptivePermissionBoundary.ts"

function boundary(stage: AdaptivePermissionBoundary["stage"]): AdaptivePermissionBoundary {
  return {
    stage,
    tier: "balanced",
    earned: stage !== "recommendations_only",
    reasons: [],
    grantedCapabilities: [],
  }
}

test("governance arbitrator: enforces rollout shadow-only mode", () => {
  const result = arbitrateGovernanceDecision({
    proposedAction: "execute_tasks",
    trustRecommendedAction: "execute_tasks",
    shadowModeActive: false,
    trustRegime: "balanced",
    trustMomentum: 0.12,
    notificationPressureState: "balanced",
    permissionBoundary: boundary("autonomous_pacing"),
    rollbackPrediction: {
      rollbackProbability: 0.1,
      trustDisruptionProbability: 0.1,
      interruptionCost: 0.2,
      shouldThrottle: false,
      recommendedAction: "execute_tasks",
      reasons: [],
    },
    autonomyConfidence: {
      decisionConfidence: 0.86,
      reversibility: 0.7,
      expectedTrustImpact: 0.8,
      interruptionCost: 0.2,
      historicalSuccessSimilarity: 0.8,
      authorityLevel: "autonomous",
    },
    operationalMode: "shadow_only",
  })

  assert.strictEqual(result.resolvedAction, "awaiting_user_action")
  assert.strictEqual(result.finalAuthoritySource, "rollout-mode")
})

test("governance arbitrator: runtime integrity failing forces safe action", () => {
  const result = arbitrateGovernanceDecision({
    proposedAction: "send_proposals",
    trustRecommendedAction: "send_proposals",
    shadowModeActive: false,
    trustRegime: "balanced",
    trustMomentum: 0.1,
    notificationPressureState: "balanced",
    permissionBoundary: boundary("autonomous_pacing"),
    rollbackPrediction: {
      rollbackProbability: 0.2,
      trustDisruptionProbability: 0.2,
      interruptionCost: 0.2,
      shouldThrottle: false,
      recommendedAction: "send_proposals",
      reasons: [],
    },
    autonomyConfidence: {
      decisionConfidence: 0.8,
      reversibility: 0.75,
      expectedTrustImpact: 0.8,
      interruptionCost: 0.2,
      historicalSuccessSimilarity: 0.75,
      authorityLevel: "autonomous",
    },
    runtimeSignal: {
      integrityScore: 0.15,
      runtimePressure: 0.88,
      degradationClassification: "failing",
      autoSafeModeRecommendation: "emergency_rollback",
    },
  })

  assert.strictEqual(result.resolvedAction, "awaiting_user_action")
  assert.strictEqual(result.finalAuthoritySource, "runtime-integrity")
  assert.ok(result.autoSafeModeRecommended)
})

test("governance arbitrator: invariant is final authority — aggressive action blocked during recovery", () => {
  // Construct a scenario where rollback/confidence do NOT pre-empt the action,
  // so "execute_tasks" reaches enforceGovernanceInvariants while inRecoveryMode=true.
  // The "never_increase_pressure_during_recovery" invariant then fires and becomes
  // the final authority.
  const result = arbitrateGovernanceDecision({
    proposedAction: "execute_tasks",
    trustRecommendedAction: "execute_tasks",
    shadowModeActive: false,
    trustRegime: "guarded",       // inRecoveryMode=true inside arbitrator
    trustMomentum: -0.05,
    notificationPressureState: "recovery",
    permissionBoundary: boundary("autonomous_pacing"),
    rollbackPrediction: {
      rollbackProbability: 0.2,
      trustDisruptionProbability: 0.2,
      interruptionCost: 0.3,
      shouldThrottle: false,      // does NOT throttle — action passes through
      recommendedAction: "execute_tasks",
      reasons: [],
    },
    autonomyConfidence: {
      decisionConfidence: 0.85,
      reversibility: 0.7,
      expectedTrustImpact: 0.8,
      interruptionCost: 0.3,
      historicalSuccessSimilarity: 0.8,
      authorityLevel: "autonomous", // high confidence — does NOT downgrade action
    },
    operationalMode: "regulated_autonomy", // no rollout constraint
    recentRollbackAt: null,
  })

  // Invariant "never_increase_pressure_during_recovery" must fire.
  assert.ok(result.invariants.violations.length >= 1)
  assert.strictEqual(result.finalAuthoritySource, "invariant")
  assert.ok(
    ["awaiting_user_action", "manual_review_required"].includes(result.resolvedAction),
    `resolved action must be safe (got '${result.resolvedAction}')`,
  )
})
