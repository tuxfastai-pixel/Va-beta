import { test } from "node:test"
import assert from "node:assert"
import { applyGovernanceAction } from "../../lib/governance/governanceActionEngine.ts"
import { listGovernanceInterventions } from "../../lib/governance/governanceInterventionLog.ts"
import { listEquilibriumEvents } from "../../lib/telemetry/equilibriumEventStream.ts"
import { loadPersonalizationStates, savePersonalizationStates } from "../../lib/personalization/personalizationStore.ts"
import type { UserPersonalizationState } from "../../lib/personalization/personalizationStore.ts"

function seedState(userId: string): UserPersonalizationState {
  const now = Date.now()
  return {
    userId,
    eventHistory: [],
    profile: {
      preferredCadenceBand: "moderate",
      preferredActionsPerHour: 6,
      toleranceThresholds: {
        pressure: 0.65,
        fatigue: 0.62,
        interruptionsPerHour: 3,
      },
      recoverySpeed: {
        medianRecoveryMs: 90 * 60 * 1000,
        confidence: 0.75,
      },
      workspaceDensityPreference: 0.5,
      interruptionSensitivity: 0.45,
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
      accelerationWindows: [9, 10, 11],
      fatigueWindows: [15, 16],
      disengagementWindows: [18],
      bestRecoveryWindows: [12],
      learnedAt: now,
    },
    recovery: {
      reducedNotificationAffinity: 0.7,
      reassuranceAffinity: 0.6,
      simplificationAffinity: 0.65,
      pacingSlowdownAffinity: 0.72,
      expectedRecoveryDurationMs: 120 * 60 * 1000,
      confidence: 0.76,
      learnedAt: now,
    },
    trust: {
      trustStability: 0.7,
      continuityConfidence: 0.78,
      adaptationComfort: 0.73,
      regulationAcceptance: 0.74,
      trustMomentum: 0.02,
      computedAt: now,
    },
    identity: {
      pacingStyle: "adaptive",
      continuityStyle: "anchor-driven",
      recoveryStyle: "paced-reset",
      communicationRhythm: "moderate",
      workspaceTolerance: "balanced",
      adaptationConfidence: 0.82,
      fingerprint: `seed-${userId}`,
      createdAt: now,
    },
    updatedAt: now,
  }
}

test("Governance actions emit telemetry, log interventions, persist rollback, and update UI state", async () => {
  const userId = `gov-actions-${Date.now().toString(16)}`
  const source = `governance-actions-test-${Date.now().toString(16)}`

  const existingStates = await loadPersonalizationStates()
  existingStates[userId] = seedState(userId)
  await savePersonalizationStates(existingStates)

  const freeze = await applyGovernanceAction({
    action: "freeze_personalization",
    actor: "test-admin",
    rationale: "freeze adaptation",
    source,
    userId,
  })

  const rollback = await applyGovernanceAction({
    action: "rollback_workspace",
    actor: "test-admin",
    rationale: "rollback workspace",
    source,
    userId,
  })

  const balanced = await applyGovernanceAction({
    action: "force_balanced_mode",
    actor: "test-admin",
    rationale: "force balanced mode",
    source,
    userId,
  })

  const emergency = await applyGovernanceAction({
    action: "emergency_safe_mode",
    actor: "test-admin",
    rationale: "emergency safe mode",
    source,
    userId,
  })

  const orchestration = await applyGovernanceAction({
    action: "disable_orchestration",
    actor: "test-admin",
    rationale: "disable orchestration",
    source,
    userId,
  })

  const pacing = await applyGovernanceAction({
    action: "disable_pacing",
    actor: "test-admin",
    rationale: "disable pacing",
    source,
    userId,
  })

  const quiet = await applyGovernanceAction({
    action: "force_quiet_notifications",
    actor: "test-admin",
    rationale: "force quiet notifications",
    source,
    userId,
  })

  assert.equal(freeze.personalizationRolloutPolicy.enabled, false)
  assert.equal(rollback.config.emergencyRollback, true)
  assert.equal(rollback.uiState.workspaceAdaptiveEnabled, false)
  assert.equal(balanced.uiState.effectivePressureState, "balanced")
  assert.equal(emergency.uiState.isEmergencyGuardrailActive, true)
  assert.equal(orchestration.uiState.orchestrationEnabled, false)
  assert.equal(pacing.uiState.autonomousPacingEnabled, false)
  assert.equal(quiet.uiState.notificationMode, "quiet")

  const afterStates = await loadPersonalizationStates()
  assert(afterStates[userId])
  assert(afterStates[userId].identity.fingerprint.startsWith("rollback-"))

  const interventions = await listGovernanceInterventions(500)
  const testInterventions = interventions.filter(
    (item) => item.metadata?.source === source && item.metadata?.userId === userId,
  )
  assert(testInterventions.length >= 7)

  const telemetryEvents = await listEquilibriumEvents({ userId, eventType: "governance_action", limit: 200 })
  const testEvents = telemetryEvents.filter((event) => event.metadata?.source === source)
  assert(testEvents.length >= 7)
  assert(testEvents.every((event) => event.eventType === "governance_action"))
})
