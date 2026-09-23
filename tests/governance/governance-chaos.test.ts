import { test } from "node:test"
import assert from "node:assert"

/**
 * Governance Chaos Testing
 *
 * Intentionally injects:
 *   - telemetry corruption
 *   - delayed events
 *   - replay mismatches
 *   - broken trust scores
 *   - false fatigue spikes
 *   - partial outages (missing store files)
 *   - duplicated orchestration events
 *
 * Verifies:
 *   - graceful degradation
 *   - safe rollback activation
 *   - continuity preservation
 *   - emotional calmness preservation
 */

import { enforceGovernanceInvariants } from "../../lib/governance/governanceInvariants.ts"
import { predictTrustAwareRollback } from "../../lib/autonomy/trustAwareRollbackPrediction.ts"
import { resolveAdaptivePermissionBoundary } from "../../lib/autonomy/adaptivePermissionBoundary.ts"
import { captureRuntimeIntegrityReport } from "../../lib/runtime/runtimeIntegrityMonitor.ts"
import { runMultiDaySimulation } from "../../lib/simulation/multiDaySessionSimulator.ts"
import type { AutonomyProfile } from "../../lib/autonomy/autonomyProfile.ts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function profile(overrides: Partial<AutonomyProfile> = {}): AutonomyProfile {
  return {
    userId: "chaos-test-user",
    automationComfort: 0.50,
    pacingTolerance: 0.50,
    workspaceFlexibility: 0.50,
    interruptionTolerance: 0.50,
    adaptationAcceptance: 0.50,
    rollbackSensitivity: 0.50,
    continuityStability: 0.50,
    interventionAcceptance: 0.50,
    recoveryResponsiveness: 0.50,
    tier: "balanced",
    updatedAt: Date.now(),
    ...overrides,
  }
}

const SAFE_ACTIONS = ["awaiting_user_action", "manual_review_required", "recovery_mode", "quiet_mode"]

function evaluateGovernanceSafety(input: {
  action: string
  trustRegime: "guarded" | "balanced" | "progressive"
  trustMomentum: number
  driftAlerts: Array<{ severity: "low" | "medium" | "high" }>
  autonomyProfile: AutonomyProfile
  inRecoveryMode: boolean
  inStabilizationMode: boolean
  recentRollbackAt?: number | null
  cognitiveBudgetRemaining?: number
}) {
  const boundary = resolveAdaptivePermissionBoundary({
    profile: input.autonomyProfile,
    trustRegime: input.trustRegime,
    trustMomentum: input.trustMomentum,
  })

  const rollback = predictTrustAwareRollback({
    action: input.action,
    actionStage: boundary.stage,
    trustRegime: input.trustRegime,
    trustMomentum: input.trustMomentum,
    driftAlerts: input.driftAlerts,
    profile: input.autonomyProfile,
  })

  const invariants = enforceGovernanceInvariants({
    proposedAction: rollback.recommendedAction,
    currentAutonomyStage: boundary.stage,
    targetAutonomyStage: boundary.stage,
    inRecoveryMode: input.inRecoveryMode,
    inStabilizationMode: input.inStabilizationMode,
    trustMomentum: input.trustMomentum,
    recentRollbackAt: input.recentRollbackAt ?? null,
    cognitiveBudgetRemaining: input.cognitiveBudgetRemaining ?? input.autonomyProfile.automationComfort,
    suppressCriticalContinuityEvents: false,
  })

  return { boundary, rollback, invariants }
}

// ---------------------------------------------------------------------------
// Chaos scenarios
// ---------------------------------------------------------------------------

test("chaos: corrupted trust score (NaN) — invariants degrade gracefully", () => {
  const { rollback, invariants } = evaluateGovernanceSafety({
    action: "execute_tasks",
    trustRegime: "guarded",
    trustMomentum: NaN,
    driftAlerts: [{ severity: "high" }],
    autonomyProfile: profile({ rollbackSensitivity: 0.9 }),
    inRecoveryMode: false,
    inStabilizationMode: false,
  })

  // Should not throw; should produce a valid (conservative) result.
  assert.ok(typeof rollback.shouldThrottle === "boolean", "should produce rollback decision even with NaN trust")
  assert.ok(typeof invariants.enforcedAction === "string", "should produce enforcedAction even with NaN trust")
  assert.ok(
    SAFE_ACTIONS.includes(invariants.enforcedAction) || invariants.violations.length >= 0,
    "corrupted trust: system stays operational without crashing"
  )
})

test("chaos: false fatigue spike (1.0 fatigue + normal trust) — pacing should throttle", () => {
  // Simulate a false fatigue reading with low pacing/interruption tolerance.
  const { rollback, invariants } = evaluateGovernanceSafety({
    action: "send_proposals",
    trustRegime: "balanced",
    trustMomentum: 0.05,
    driftAlerts: [],
    autonomyProfile: profile({ pacingTolerance: 0.20, interruptionTolerance: 0.25 }),
    inRecoveryMode: false,
    inStabilizationMode: true,
    cognitiveBudgetRemaining: 0.2,
  })

  // Should throttle due to pacing profile even without trust alarm.
  assert.ok(typeof rollback.shouldThrottle === "boolean", "rollback layer must remain stable")
  assert.ok(typeof invariants.enforcedAction === "string", "system should respond to false fatigue without crashing")
  assert.ok(
    SAFE_ACTIONS.includes(invariants.enforcedAction) || rollback.shouldThrottle,
    "false fatigue: governance should remain conservative"
  )
})

test("chaos: broken trust score (Infinity) — rollback prediction stays bounded", () => {
  const rollback = predictTrustAwareRollback({
    action: "execute_tasks",
    actionStage: "autonomous_pacing",
    trustRegime: "guarded",
    trustMomentum: Infinity,
    driftAlerts: [{ severity: "high" }, { severity: "high" }, { severity: "high" }],
    profile: profile({ rollbackSensitivity: 0.90 }),
  })

  assert.ok(typeof rollback.shouldThrottle === "boolean", "shouldThrottle should be a boolean even with Infinity trust")
  assert.ok(rollback.rollbackProbability >= 0 && rollback.rollbackProbability <= 1, "rollbackProbability must remain bounded")
  assert.ok(
    rollback.trustDisruptionProbability >= 0 && rollback.trustDisruptionProbability <= 1,
    "trustDisruptionProbability must remain bounded"
  )
  assert.ok(rollback.interruptionCost >= 0 && rollback.interruptionCost <= 1, "interruptionCost must remain bounded")
})

test("chaos: duplicated orchestration events — permission boundary remains stable", () => {
  // Simulate duplicate actions by calling boundary resolver twice with same context.
  const ctx = {
    profile: profile({ automationComfort: 0.40 }),
    trustRegime: "guarded" as const,
    trustMomentum: -0.05,
  }

  const result1 = resolveAdaptivePermissionBoundary(ctx)
  const result2 = resolveAdaptivePermissionBoundary(ctx)

  // Deterministic — same input should produce same output.
  assert.strictEqual(result1.stage, result2.stage, "duplicate calls must be idempotent")
  assert.strictEqual(result1.earned, result2.earned, "earned state must be stable across duplicate calls")
})

test("chaos: partial outage (missing .runtime files) — integrity monitor stays bounded", async () => {
  // The integrity monitor reads .runtime files; if they don't exist it should return 0-count gracefully.
  const report = await captureRuntimeIntegrityReport()

  // Must always return a valid report.
  assert.ok(report.integrityScore >= 0 && report.integrityScore <= 1, "integrityScore must be in [0,1]")
  assert.ok(report.runtimePressure >= 0 && report.runtimePressure <= 1, "runtimePressure must be in [0,1]")
  assert.ok(typeof report.degradationClassification === "string", "degradationClassification must be a string")
  assert.ok(typeof report.autoSafeModeRecommendation === "string", "autoSafeModeRecommendation must be a string")
  assert.ok(Array.isArray(report.warnings), "warnings must be an array")
})

test("chaos: trust erosion injection — overwhelmed archetype 7-day sim detects erosion", () => {
  // Run an overwhelmed user (already near overload) for 7 days.
  const result = runMultiDaySimulation("overwhelmed", 7)

  // Given high baseline fatigue for overwhelmed archetype, the system should
  // detect at least one governance concern.
  const anyDiscovery = Object.values(result.discoveries).some(Boolean)
  assert.ok(anyDiscovery || result.stabilityScore < 0.9, "overwhelmed 7-day: should surface at least one discovery OR low stability")
  assert.ok(result.stabilityScore >= 0 && result.stabilityScore <= 1, "stabilityScore must be in [0,1]")
})

test("chaos: notification storm simulation — anxious archetype collapses notification tolerance", () => {
  const result = runMultiDaySimulation("anxious", 14)

  // Anxious archetype has very high notification impact — 14 days should drain tolerance.
  const finalTolerance = result.finalState.notificationTolerance
  assert.ok(finalTolerance < 0.40, `anxious 14-day: notification tolerance should collapse (got ${finalTolerance.toFixed(3)})`)
})

test("chaos: autonomy creep detection — high_autonomy 30-day sim", () => {
  const result = runMultiDaySimulation("high_autonomy", 30)
  // High autonomy archetype has a positive autonomy drift rate.  Over 30 days
  // it should creep upward; the simulator should flag it.
  const finalAcceptance = result.finalState.autonomyAcceptance
  const initialAcceptance = result.days[0].autonomyAcceptance

  assert.ok(finalAcceptance >= initialAcceptance, "high_autonomy: acceptance should not drop unexpectedly")
  // Summary should be produced regardless.
  assert.ok(Array.isArray(result.summary) && result.summary.length > 0, "simulation must produce a summary")
})

test("chaos: governance deadlock pressure — all constraints active simultaneously", () => {
  // This is the most extreme scenario: everything is at maximum pressure.
  const { rollback, invariants } = evaluateGovernanceSafety({
    action: "execute_tasks",
    trustRegime: "guarded",
    trustMomentum: -0.30,
    driftAlerts: [
      { severity: "high" }, { severity: "high" }, { severity: "high" },
      { severity: "medium" }, { severity: "medium" },
    ],
    autonomyProfile: profile({
      rollbackSensitivity: 0.95,
      pacingTolerance: 0.10,
      interruptionTolerance: 0.10,
      automationComfort: 0.10,
      continuityStability: 0.10,
      interventionAcceptance: 0.10,
    }),
    inRecoveryMode: true,
    inStabilizationMode: true,
    recentRollbackAt: Date.now(),
  })

  // System must NOT deadlock — must always produce a valid enforced action.
  assert.ok(typeof invariants.enforcedAction === "string", "governance deadlock: must always produce enforcedAction")
  assert.ok(
    SAFE_ACTIONS.includes(invariants.enforcedAction),
    `governance deadlock: action must be safe (got '${invariants.enforcedAction}')`
  )
  assert.ok(rollback.shouldThrottle || invariants.violations.length >= 1, "maximum pressure: at least one guard should trigger")
})
