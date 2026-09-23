import { test } from "node:test"
import assert from "node:assert"
import { appendIdentityDriftAlert } from "../../lib/personalization/identityDriftAlerts.ts"
import { appendEquilibriumEvent } from "../../lib/telemetry/equilibriumEventStream.ts"
import { applyGovernanceAction } from "../../lib/governance/governanceActionEngine.ts"
import { listInterventionTimeline } from "../../lib/governance/interventionTimeline.ts"
import { listGovernanceInterventions } from "../../lib/governance/governanceInterventionLog.ts"
import { loadPersonalizationStates, savePersonalizationStates, getPersonalizationState } from "../../lib/personalization/personalizationStore.ts"
import type { UserPersonalizationState } from "../../lib/personalization/personalizationStore.ts"

function seedState(userId: string): UserPersonalizationState {
  const now = Date.now()
  return {
    userId,
    eventHistory: [],
    profile: {
      preferredCadenceBand: "moderate",
      preferredActionsPerHour: 5,
      workspaceDensityPreference: 0.48,
      interruptionSensitivity: 0.5,
      toleranceThresholds: { pressure: 0.62, fatigue: 0.6, interruptionsPerHour: 3 },
      recoverySpeed: {
        medianRecoveryMs: 100 * 60 * 1000,
        confidence: 0.72,
      },
      computedAt: now,
    },
    rhythm: {
      hourlyProfile: Array.from({ length: 24 }).map((_, hour) => ({
        hour,
        accelerationScore: 0.5,
        fatigueScore: 0.5,
        disengagementScore: 0.5,
        recoveryScore: 0.5,
      })),
      accelerationWindows: [9, 10],
      fatigueWindows: [16],
      disengagementWindows: [19],
      bestRecoveryWindows: [12],
      learnedAt: now,
    },
    recovery: {
      reducedNotificationAffinity: 0.72,
      reassuranceAffinity: 0.68,
      simplificationAffinity: 0.65,
      pacingSlowdownAffinity: 0.74,
      expectedRecoveryDurationMs: 110 * 60 * 1000,
      confidence: 0.78,
      learnedAt: now,
    },
    trust: {
      trustStability: 0.66,
      continuityConfidence: 0.73,
      adaptationComfort: 0.68,
      regulationAcceptance: 0.69,
      trustMomentum: -0.08,
      computedAt: now,
    },
    identity: {
      pacingStyle: "adaptive",
      continuityStyle: "anchor-driven",
      recoveryStyle: "paced-reset",
      communicationRhythm: "moderate",
      workspaceTolerance: "balanced",
      adaptationConfidence: 0.8,
      fingerprint: `seed-${userId}`,
      createdAt: now,
    },
    updatedAt: now,
  }
}

test("Admin intervention flow preserves timeline integrity, auditability, continuity, and calm messaging", async () => {
  const userId = `admin-flow-${Date.now().toString(16)}`
  const source = `admin-intervention-flow-test-${Date.now().toString(16)}`

  const states = await loadPersonalizationStates()
  states[userId] = seedState(userId)
  await savePersonalizationStates(states)
  const before = await getPersonalizationState(userId)
  assert(before)

  const now = Date.now()
  await appendIdentityDriftAlert({
    userId,
    delta: 0.81,
    previousFingerprint: before!.identity.fingerprint,
    nextFingerprint: "drifted-fingerprint",
    summary: "Critical drift alert",
    timestamp: now,
  })

  const recoveryAction = await applyGovernanceAction({
    action: "trigger_recovery_mode",
    actor: "admin-operator",
    rationale: "drift alert intervention",
    source,
    userId,
  })

  const rollbackAction = await applyGovernanceAction({
    action: "rollback_workspace",
    actor: "admin-operator",
    rationale: "rollback approval",
    source,
    userId,
  })

  await appendEquilibriumEvent({
    userId,
    eventType: "admin_recovery_activation",
    previousState: "accelerated",
    nextState: "recovery",
    pressureLevel: 0.78,
    fatigueRisk: 0.82,
    recoveryTriggered: true,
    metadata: { source },
  })

  await appendEquilibriumEvent({
    userId,
    eventType: "equilibrium_stabilized",
    previousState: "recovery",
    nextState: "balanced",
    pressureLevel: 0.45,
    fatigueRisk: 0.32,
    recoveryTriggered: false,
    metadata: { source },
  })

  const timeline = await listInterventionTimeline({ userId, timelineLimit: 200, alertsLimit: 100 })
  assert(timeline.length >= 5)
  for (let i = 1; i < timeline.length; i += 1) {
    assert(timeline[i - 1].timestamp >= timeline[i].timestamp)
  }

  const timelineKinds = new Set(timeline.map((item) => item.kind))
  assert(timelineKinds.has("drift_event"))
  assert(timelineKinds.has("intervention"))
  assert(timelineKinds.has("rollback"))
  assert(timelineKinds.has("recovery_activation"))
  assert(timelineKinds.has("equilibrium_transition"))

  const interventionLog = await listGovernanceInterventions(300)
  const auditItems = interventionLog.filter(
    (entry) => entry.metadata?.source === source && entry.metadata?.userId === userId,
  )
  assert(auditItems.length >= 2)
  assert(auditItems.some((entry) => entry.rationale.includes("drift alert intervention")))
  assert(auditItems.some((entry) => entry.rationale.includes("rollback approval")))

  const after = await getPersonalizationState(userId)
  assert(after)
  assert.equal(after!.userId, before!.userId)
  assert(after!.updatedAt >= before!.updatedAt)
  assert(after!.identity.fingerprint.startsWith("rollback-"))

  assert(/calm|recovery|stability|continuity/i.test(recoveryAction.calmMessage))
  assert(/restore|stable|continuity/i.test(rollbackAction.calmMessage))
})
