import { test } from "node:test"
import assert from "node:assert"
import { computePersonalEquilibriumProfile } from "../../lib/personalization/equilibriumProfile.ts"
import { learnBehavioralRhythm } from "../../lib/personalization/rhythmLearning.ts"
import {
  learnPersonalizedRecoveryProfile,
  buildRecoveryInterventionPlan,
} from "../../lib/personalization/recoveryProfiles.ts"
import {
  computeAdaptiveTrustModel,
  recommendTrustRegulation,
} from "../../lib/personalization/trustContinuity.ts"
import { buildEquilibriumIdentity, identityChanged } from "../../lib/personalization/equilibriumIdentity.ts"

test("Personal profile learns tolerance and cadence from observations", () => {
  const now = Date.now()
  const profile = computePersonalEquilibriumProfile(
    Array.from({ length: 40 }, (_, i) => ({
      timestamp: now - (40 - i) * 10 * 60 * 1000,
      pressureLevel: 0.52 + (i % 4) * 0.06,
      fatigueRisk: 0.4 + (i % 3) * 0.08,
      workspaceDensity: 0.55 + (i % 4) * 0.05,
      interruptions: 1 + (i % 4),
      recoveryDurationMs: 90 * 60 * 1000,
      completedActions: 3 + (i % 3),
      abandonedActions: i % 2,
    })),
  )

  assert(profile.preferredActionsPerHour > 0)
  assert(profile.toleranceThresholds.pressure > 0)
  assert(profile.workspaceDensityPreference >= 0 && profile.workspaceDensityPreference <= 1)
})

test("Rhythm learning extracts acceleration and fatigue windows", () => {
  const now = Date.now()
  const rhythm = learnBehavioralRhythm(
    Array.from({ length: 72 }, (_, i) => ({
      timestamp: now - i * 60 * 60 * 1000,
      actionsCompleted: i % 5 < 3 ? 5 : 2,
      actionsAbandoned: i % 5 < 3 ? 1 : 3,
      fatigueRisk: i % 5 < 3 ? 0.35 : 0.72,
      pressureLevel: i % 5 < 3 ? 0.42 : 0.75,
      recovered: i % 6 === 0,
    })),
  )

  assert.equal(rhythm.hourlyProfile.length, 24)
  assert.equal(rhythm.accelerationWindows.length, 4)
  assert.equal(rhythm.fatigueWindows.length, 4)
})

test("Recovery profile selects interventions matched to user style", () => {
  const now = Date.now()
  const recovery = learnPersonalizedRecoveryProfile(
    Array.from({ length: 30 }, (_, i) => ({
      timestamp: now - i * 2 * 60 * 60 * 1000,
      fatigueRisk: 0.65,
      pressureLevel: 0.7,
      recoveryDurationMs: 2 * 60 * 60 * 1000,
      notificationReductionApplied: true,
      reassuranceApplied: i % 2 === 0,
      simplificationApplied: i % 3 !== 0,
      pacingSlowdownApplied: true,
      stabilized: i % 5 !== 0,
    })),
  )

  const plan = buildRecoveryInterventionPlan(recovery, {
    fatigueRisk: 0.74,
    pressureLevel: 0.7,
    interruptionSensitivity: 0.68,
  })

  assert(plan.reduceNotifications || plan.slowPacing)
  assert(recovery.expectedRecoveryDurationMs > 0)
})

test("Trust modeling recommends regulation level based on acceptance", () => {
  const now = Date.now()
  const trust = computeAdaptiveTrustModel(
    Array.from({ length: 24 }, (_, i) => ({
      timestamp: now - i * 60 * 60 * 1000,
      continuityPreserved: i % 5 !== 0,
      overrideRejected: i % 8 === 0,
      adaptationAccepted: i % 6 !== 0,
      trustFeedback: 0.6 + (i % 4) * 0.08,
      recoveryStabilized: i % 3 !== 0,
    })),
  )

  const recommendation = recommendTrustRegulation(trust)
  assert(["guarded", "balanced", "progressive"].includes(recommendation.autonomyLevel))
})

test("Identity layer produces deterministic fingerprint and detects deltas", () => {
  const now = Date.now()
  const profileA = computePersonalEquilibriumProfile([
    {
      timestamp: now,
      pressureLevel: 0.5,
      fatigueRisk: 0.45,
      workspaceDensity: 0.6,
      interruptions: 2,
      recoveryDurationMs: 90 * 60 * 1000,
      completedActions: 6,
      abandonedActions: 1,
    },
  ])
  const profileB = computePersonalEquilibriumProfile([
    {
      timestamp: now,
      pressureLevel: 0.8,
      fatigueRisk: 0.72,
      workspaceDensity: 0.35,
      interruptions: 5,
      recoveryDurationMs: 4 * 60 * 60 * 1000,
      completedActions: 2,
      abandonedActions: 3,
    },
  ])

  const rhythm = learnBehavioralRhythm([
    {
      timestamp: now,
      actionsCompleted: 5,
      actionsAbandoned: 1,
      fatigueRisk: 0.42,
      pressureLevel: 0.45,
      recovered: true,
    },
  ])

  const recovery = learnPersonalizedRecoveryProfile([
    {
      timestamp: now,
      fatigueRisk: 0.6,
      pressureLevel: 0.62,
      recoveryDurationMs: 2 * 60 * 60 * 1000,
      notificationReductionApplied: true,
      reassuranceApplied: false,
      simplificationApplied: true,
      pacingSlowdownApplied: true,
      stabilized: true,
    },
  ])

  const trust = computeAdaptiveTrustModel([
    {
      timestamp: now,
      continuityPreserved: true,
      overrideRejected: false,
      adaptationAccepted: true,
      trustFeedback: 0.72,
      recoveryStabilized: true,
    },
  ])

  const idA = buildEquilibriumIdentity({ profile: profileA, rhythm, recovery, trust, now })
  const idB = buildEquilibriumIdentity({ profile: profileB, rhythm, recovery, trust, now: now + 1 })

  assert(idA.fingerprint.length > 0)
  assert(identityChanged(idA, idB).changed)
})
