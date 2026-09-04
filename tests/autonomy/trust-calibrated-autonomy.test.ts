import { test } from "node:test"
import assert from "node:assert"
import { deriveAutonomyTier, learnAutonomyProfile, loadAutonomyProfile } from "../../lib/autonomy/autonomyProfile.ts"
import { summarizeInterventionAcceptance } from "../../lib/autonomy/interventionAcceptanceLearning.ts"
import {
  canExecuteActionWithinBoundary,
  getRequiredAutonomyStageForAction,
  resolveAdaptivePermissionBoundary,
} from "../../lib/autonomy/adaptivePermissionBoundary.ts"
import { predictTrustAwareRollback } from "../../lib/autonomy/trustAwareRollbackPrediction.ts"
import { summarizeRecoveryEffectiveness } from "../../lib/autonomy/recoveryEffectivenessLearning.ts"
import { enforceGovernanceInvariants } from "../../lib/governance/governanceInvariants.ts"
import type { TrustHistoryRecord } from "../../lib/trust/trustHistoryStore.ts"
import type { SessionContinuityRecord } from "../../lib/continuity/sessionContinuityStore.ts"

function seedTrustRecord(userId: string): TrustHistoryRecord {
  const now = Date.now()
  return {
    userId,
    trustWindows: [],
    transitions: [
      {
        timestamp: now,
        previousRegime: "balanced",
        nextRegime: "progressive",
        reason: "stable trust",
      },
    ],
    interventionEffects: [
      { timestamp: now - 3_000, interventionType: "calm_prompt", accepted: true, perceivedSupport: 0.82 },
      { timestamp: now - 2_000, interventionType: "calm_prompt", accepted: true, perceivedSupport: 0.78 },
      { timestamp: now - 1_000, interventionType: "workspace_reset", accepted: false, perceivedSupport: 0.24 },
      { timestamp: now, interventionType: "workspace_reset", accepted: false, perceivedSupport: 0.2 },
    ],
    pacingReactions: [],
    recoveryOutcomes: [
      { timestamp: now - 2_000, strategy: "guided_reentry", successful: true, userConfidence: 0.84 },
      { timestamp: now - 1_000, strategy: "guided_reentry", successful: true, userConfidence: 0.81 },
      { timestamp: now, strategy: "hard_reset", successful: false, userConfidence: 0.35 },
    ],
    autonomyAcceptance: [],
    driftAlerts: [],
    updatedAt: now,
  }
}

function seedContinuityRecord(userId: string): SessionContinuityRecord {
  const now = Date.now()
  return {
    userId,
    latestStableSnapshot: null,
    lastStableWorkspace: null,
    recoveryCheckpoints: [],
    equilibriumRecoveryHistory: [
      { timestamp: now - 5_000, phase: "recover", strategy: "guided_reentry", confidence: 0.82 },
      { timestamp: now - 4_000, phase: "stabilize", strategy: "guided_reentry", confidence: 0.8 },
      { timestamp: now - 3_000, phase: "stabilize", strategy: "guided_reentry", confidence: 0.86 },
      { timestamp: now - 2_000, phase: "recover", strategy: "hard_reset", confidence: 0.4 },
    ],
    interruptionCauses: [],
    mutationLedger: [],
    updatedAt: now,
  }
}

test("Autonomy tier reflects comfort, acceptance, and rollback sensitivity", async () => {
  const userId = `autonomy-tier-${Date.now().toString(16)}`

  let profile = await learnAutonomyProfile(
    userId,
    {
      automationComfort: 0.9,
      pacingTolerance: 0.85,
      workspaceFlexibility: 0.82,
      interruptionTolerance: 0.8,
      adaptationAcceptance: 0.88,
      rollbackSensitivity: 0.18,
      continuityStability: 0.84,
      interventionAcceptance: 0.86,
      recoveryResponsiveness: 0.9,
    },
    { mutationKey: `${userId}:seed:1` },
  )

  profile = await learnAutonomyProfile(
    userId,
    {
      automationComfort: 0.9,
      pacingTolerance: 0.85,
      workspaceFlexibility: 0.82,
      interruptionTolerance: 0.8,
      adaptationAcceptance: 0.88,
      rollbackSensitivity: 0.18,
      continuityStability: 0.84,
      interventionAcceptance: 0.86,
      recoveryResponsiveness: 0.9,
    },
    { mutationKey: `${userId}:seed:2` },
  )

  assert.notEqual(profile.tier, "conservative")
  assert.equal(deriveAutonomyTier(profile), profile.tier)
})

test("Intervention acceptance learning distinguishes accepted and rejected interventions", () => {
  const record = seedTrustRecord("acceptance-user")
  const summary = summarizeInterventionAcceptance(record)

  assert(summary.acceptanceScore > 0.45)
  assert(summary.topAcceptedInterventions.includes("calm_prompt"))
  assert(summary.topRejectedInterventions.includes("workspace_reset"))
})

test("Adaptive permission boundaries earn autonomy through trust and continuity", async () => {
  const userId = `boundary-${Date.now().toString(16)}`

  const profile = await learnAutonomyProfile(
    userId,
    {
      automationComfort: 0.78,
      pacingTolerance: 0.8,
      workspaceFlexibility: 0.7,
      interruptionTolerance: 0.72,
      adaptationAcceptance: 0.76,
      rollbackSensitivity: 0.25,
      continuityStability: 0.77,
      interventionAcceptance: 0.74,
      recoveryResponsiveness: 0.8,
    },
    { mutationKey: `${userId}:profile` },
  )

  const boundary = resolveAdaptivePermissionBoundary({
    profile,
    trustRegime: "progressive",
    trustMomentum: 0.06,
  })

  assert.notEqual(boundary.stage, "recommendations_only")
  assert(canExecuteActionWithinBoundary(boundary, "send_proposals"))
  assert.equal(getRequiredAutonomyStageForAction("execute_tasks"), "autonomous_pacing")
})

test("Rollback predictor throttles risky autonomy under trust decline", async () => {
  const userId = `rollback-risk-${Date.now().toString(16)}`

  await learnAutonomyProfile(
    userId,
    {
      automationComfort: 0.35,
      pacingTolerance: 0.42,
      workspaceFlexibility: 0.4,
      interruptionTolerance: 0.38,
      adaptationAcceptance: 0.34,
      rollbackSensitivity: 0.83,
      continuityStability: 0.3,
      interventionAcceptance: 0.28,
      recoveryResponsiveness: 0.35,
    },
    { mutationKey: `${userId}:risk` },
  )

  const profile = await loadAutonomyProfile(userId)
  const prediction = predictTrustAwareRollback({
    action: "execute_tasks",
    actionStage: "autonomous_pacing",
    trustRegime: "guarded",
    trustMomentum: -0.18,
    driftAlerts: [{ severity: "high" }, { severity: "medium" }],
    profile,
  })

  assert(prediction.shouldThrottle)
  assert(["manual_review_required", "awaiting_user_action"].includes(prediction.recommendedAction))
  assert(prediction.rollbackProbability > 0.55)
})

test("Recovery effectiveness learning identifies strong recovery strategies", () => {
  const trustRecord = seedTrustRecord("recovery-user")
  const continuityRecord = seedContinuityRecord("recovery-user")

  const summary = summarizeRecoveryEffectiveness({ continuityRecord, trustRecord })
  assert(summary.overallResponsiveness > 0.5)
  assert(summary.fastestRecoveryStrategies.includes("guided_reentry"))
  assert(summary.highestTrustLiftStrategies.includes("guided_reentry"))
})

test("Governance invariants prevent unsafe autonomy escalations", () => {
  const result = enforceGovernanceInvariants({
    proposedAction: "execute_tasks",
    currentAutonomyStage: "passive_adaptation",
    targetAutonomyStage: "autonomous_workspace_restructuring",
    inRecoveryMode: true,
    inStabilizationMode: true,
    trustMomentum: -0.22,
    recentRollbackAt: Date.now(),
    cognitiveBudgetRemaining: 0.2,
    suppressCriticalContinuityEvents: true,
  })

  assert(result.violations.length >= 2)
  assert(["manual_review_required", "awaiting_user_action"].includes(result.enforcedAction))
  assert.equal(result.suppressCriticalContinuityEvents, false)
})
