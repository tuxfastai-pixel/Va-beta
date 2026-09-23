import { test } from "node:test"
import assert from "node:assert"
import { composeContinuityMessage } from "../../lib/continuity/continuityMessageComposer.ts"
import {
  appendRecoveryCheckpoint,
  loadSessionContinuityRecord,
  persistStableSnapshot,
  type InterruptionCauseType,
} from "../../lib/continuity/sessionContinuityStore.ts"
import { reconcileAndPersistSessionResume } from "../../lib/continuity/sessionResumeReconciler.ts"
import { createSessionSnapshot } from "../../lib/continuity/sessionSnapshot.ts"

const FAILURE_SCENARIOS: InterruptionCauseType[] = [
  "browser_crash",
  "api_failure",
  "websocket_disconnect",
  "mobile_background_resume",
  "telemetry_corruption",
  "partial_orchestration_failure",
  "interrupted_recovery_cycle",
  "interrupted_autonomous_regulation",
]

test("Failure-mode replay preserves continuity, avoids duplicate mutation, prevents state explosion, and restores calm messaging", async () => {
  const userId = `continuity-failure-${Date.now().toString(16)}`
  const baseTime = Date.now()

  const initialSnapshot = createSessionSnapshot({
    userId,
    timestamp: baseTime - 25 * 60 * 1000,
    equilibriumState: {
      mode: "accelerated",
      fatigueRisk: 0.62,
      trustStability: 0.7,
      momentum: 0.79,
    },
    workspaceState: {
      density: "expanded",
      activeModules: ["dashboard", "workflow", "results", "outreach"],
      hiddenModules: ["archive"],
    },
    continuityState: {
      activeTrajectory: "close_weekly_pipeline",
      lastMeaningfulAction: "prioritize_followups",
      interruptedFlow: "reviewing_high_priority_leads",
      confidenceOfDirection: 0.72,
    },
    recoveryState: {
      activeRecoveryStrategy: "paced_reset",
      recoveryProgress: 0.36,
    },
    notificationState: {
      cadence: "fast",
      suppressionLevel: "none",
    },
    continuityConfidence: 0.74,
  })

  await persistStableSnapshot(initialSnapshot, { mutationKey: `${userId}:seed` })

  let now = baseTime
  const results = [] as Array<{
    cause: InterruptionCauseType
    message: string
    decision: string
  }>

  for (const cause of FAILURE_SCENARIOS) {
    now += 90 * 1000
    const plan = await reconcileAndPersistSessionResume({ userId, interruptionCause: cause, now })
    assert(plan)

    const message = composeContinuityMessage({ plan: plan!, interruptionCause: cause })
    results.push({ cause, message, decision: plan!.decision })

    assert(plan!.nextSnapshot.continuityState.activeTrajectory.length > 0)
    assert(plan!.nextSnapshot.continuityConfidence >= 0)
    assert(plan!.nextSnapshot.continuityConfidence <= 1)

    // Ensure no duplicate mutation from replaying the same failure event id.
    const replay = await reconcileAndPersistSessionResume({ userId, interruptionCause: cause, now })
    assert(replay)

    const before = await loadSessionContinuityRecord(userId)
    const checkpointCountBefore = before.recoveryCheckpoints.length
    await appendRecoveryCheckpoint(
      userId,
      {
        timestamp: now,
        snapshot: plan!.nextSnapshot,
        strategy: plan!.decision,
        progress: plan!.nextSnapshot.recoveryState.recoveryProgress,
      },
      { mutationKey: `${replay!.mutationKey}:checkpoint` },
    )
    const after = await loadSessionContinuityRecord(userId)
    assert.equal(after.recoveryCheckpoints.length, checkpointCountBefore)

    assert(!/restoring state/i.test(message))
    assert(!/recovering session/i.test(message))
    assert(!/loading continuity/i.test(message))
  }

  const record = await loadSessionContinuityRecord(userId)
  assert(record.latestStableSnapshot)
  assert(record.lastStableWorkspace)

  // State explosion guard: store should cap unbounded arrays.
  assert(record.recoveryCheckpoints.length <= 40)
  assert(record.equilibriumRecoveryHistory.length <= 120)
  assert(record.interruptionCauses.length <= 120)

  // Pacing guard: every replay decision should map to a valid pacing-aware message.
  assert(results.every((item) => /Pacing will/i.test(item.message)))

  const stabilizeForTelemetry = results.find((item) => item.cause === "telemetry_corruption")
  assert(stabilizeForTelemetry)
  assert.equal(stabilizeForTelemetry!.decision, "stabilize")
})
