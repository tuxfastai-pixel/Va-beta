import { test } from "node:test"
import assert from "node:assert"
import { buildAutonomyAuditSnapshot } from "../../lib/autonomy/autonomyAuditSnapshot.ts"
import { learnAutonomyProfile } from "../../lib/autonomy/autonomyProfile.ts"

const strongSignals = {
  automationComfort: 0.86,
  pacingTolerance: 0.82,
  workspaceFlexibility: 0.8,
  interruptionTolerance: 0.78,
  adaptationAcceptance: 0.84,
  rollbackSensitivity: 0.18,
  continuityStability: 0.84,
  interventionAcceptance: 0.82,
  recoveryResponsiveness: 0.88,
}

test("Autonomy audit snapshot exposes tier and rollback signals", async () => {
  const userId = `autonomy-audit-${Date.now().toString(16)}`

  await learnAutonomyProfile(userId, strongSignals, { mutationKey: `${userId}:seed` })
  await learnAutonomyProfile(userId, strongSignals, { mutationKey: `${userId}:seed-2` })

  const snapshot = await buildAutonomyAuditSnapshot({ userId, limit: 10 })

  assert.equal(snapshot.status, "ok")
  assert.equal(snapshot.filters.userId, userId)
  assert.equal(typeof snapshot.globalPosture.operationalMode, "string")
  assert(snapshot.items.length >= 1)
  assert.equal(snapshot.items[0].userId, userId)
  assert(["conservative", "balanced", "progressive", "highly_autonomous"].includes(snapshot.items[0].autonomyTier))
  assert(snapshot.items[0].rollbackRisk >= 0)
  assert.equal(Array.isArray(snapshot.items[0].currentConstraints.activeThrottles), true)
  assert.equal(Array.isArray(snapshot.items[0].governanceEnforcement.invariantViolations), true)
  assert.equal(Array.isArray(snapshot.items[0].recoveryEffectiveness.topSuccessfulRecoveryStrategies), true)
  assert.equal(typeof snapshot.items[0].behavioralDriftIndicators.trustVolatility, "number")
  assert.equal(typeof snapshot.items[0].autonomyConfidence.decisionConfidence, "number")
  assert.equal(typeof snapshot.items[0].adaptiveRiskForecast.probableRollbackNextSession, "number")
  assert.equal(Array.isArray(snapshot.userStabilityGrid), true)
  assert.equal(Array.isArray(snapshot.invariantViolationsTimeline), true)
  assert.equal(Array.isArray(snapshot.autonomyDecisionReplay), true)
})
