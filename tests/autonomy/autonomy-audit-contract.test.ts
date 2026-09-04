import { test } from "node:test"
import assert from "node:assert"

import { buildAutonomyAuditSnapshot } from "../../lib/autonomy/autonomyAuditSnapshot.ts"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

test("Autonomy audit snapshot exposes the Phase 15.5 contract shape", async () => {
  const snapshot = await buildAutonomyAuditSnapshot({ limit: 10 })

  assert.equal(snapshot.status, "ok")
  assert.equal(typeof snapshot.generatedAt, "string")
  assert(isObject(snapshot.filters))

  assert(isObject(snapshot.globalPosture))
  assert.equal(typeof snapshot.globalPosture.operationalMode, "string")
  assert.equal(typeof snapshot.globalPosture.safeMode, "boolean")

  assert(isObject(snapshot.systemAutonomyHealth))
  assert(isObject(snapshot.systemAutonomyHealth.activeAutonomyTiers))
  assert.equal(typeof snapshot.systemAutonomyHealth.throttledUsers, "number")
  assert(isObject(snapshot.systemAutonomyHealth.rollbackRiskDistribution))

  assert(Array.isArray(snapshot.userStabilityGrid))
  assert(Array.isArray(snapshot.invariantViolationsTimeline))
  assert(Array.isArray(snapshot.autonomyDecisionReplay))
  assert(isObject(snapshot.shadowLiveDivergence))
  assert(isObject(snapshot.governanceHeatmap))
  assert(isObject(snapshot.recoveryIntelligenceEffectiveness))

  if (snapshot.userStabilityGrid.length > 0) {
    const first = snapshot.userStabilityGrid[0]

    assert.equal(typeof first.userId, "string")
    assert.equal(typeof first.autonomyTier, "string")
    assert.equal(typeof first.permissionBoundaryStage, "string")
    assert.equal(typeof first.trustRegime, "string")
    assert.equal(typeof first.continuityConfidence, "number")
    assert.equal(typeof first.adaptiveComfort, "number")

    assert(isObject(first.currentConstraints))
    assert(Array.isArray(first.currentConstraints.activeThrottles))
    assert(Array.isArray(first.currentConstraints.pacingModifiers))
    assert(Array.isArray(first.currentConstraints.deniedActions))

    assert(isObject(first.governanceEnforcement))
    assert(Array.isArray(first.governanceEnforcement.invariantViolations))

    assert(isObject(first.recoveryEffectiveness))
    assert(Array.isArray(first.recoveryEffectiveness.topSuccessfulRecoveryStrategies))

    assert(isObject(first.behavioralDriftIndicators))
    assert.equal(typeof first.behavioralDriftIndicators.trustVolatility, "number")

    assert(isObject(first.autonomyConfidence))
    assert.equal(typeof first.autonomyConfidence.decisionConfidence, "number")

    assert(isObject(first.adaptiveRiskForecast))
    assert.equal(typeof first.adaptiveRiskForecast.probableRollbackNextSession, "number")
  }
})
