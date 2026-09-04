import {
  appendInterruptionCause,
  appendRecoveryCheckpoint,
  appendRecoveryHistory,
  loadSessionContinuityRecord,
  type InterruptionCauseType,
} from "./sessionContinuityStore.ts"
import { createSessionSnapshot, type SessionSnapshot } from "./sessionSnapshot.ts"

export type ResumeDecision = "resume" | "simplify" | "recover" | "stabilize"

export type SessionResumeInput = {
  snapshot: SessionSnapshot
  interruptionCause?: InterruptionCauseType
  now?: number
}

export type SessionResumePlan = {
  decision: ResumeDecision
  continuityConfidence: number
  reason: string
  recommendedPacing: "steady" | "gentle" | "conservative"
  nextSnapshot: SessionSnapshot
}

export type PersistedSessionResumePlan = SessionResumePlan & {
  mutationKey: string
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5
  }
  return Math.max(0, Math.min(1, value))
}

function buildMutationKey(
  userId: string,
  timestamp: number,
  interruptionCause: InterruptionCauseType | undefined,
): string {
  return ["resume-reconcile", userId, String(timestamp), interruptionCause ?? "none"].join(":")
}

export function reconcileSessionResume(input: SessionResumeInput): SessionResumePlan {
  const now = Number(input.now ?? Date.now())
  const snapshot = input.snapshot
  const interruptionCause = input.interruptionCause
  const gapMs = Math.max(0, now - snapshot.timestamp)

  const overloadRisk =
    snapshot.equilibriumState.fatigueRisk >= 0.72 ||
    snapshot.workspaceState.density === "expanded" ||
    snapshot.notificationState.suppressionLevel === "none"

  const unstableMode =
    snapshot.equilibriumState.mode === "stabilizing" ||
    snapshot.equilibriumState.mode === "recovery" ||
    snapshot.equilibriumState.mode === "locked"

  const highMomentum =
    snapshot.equilibriumState.momentum >= 0.72 &&
    snapshot.equilibriumState.fatigueRisk <= 0.55 &&
    snapshot.continuityState.confidenceOfDirection >= 0.62

  const telemetryUncertain = interruptionCause === "telemetry_corruption"
  const partialFailure = interruptionCause === "partial_orchestration_failure"
  const interruptedRecovery = interruptionCause === "interrupted_recovery_cycle"
  const interruptedRegulation = interruptionCause === "interrupted_autonomous_regulation"

  const confidencePenalty =
    (gapMs > 12 * 60 * 60 * 1000 ? 0.12 : 0) +
    (gapMs > 36 * 60 * 60 * 1000 ? 0.14 : 0) +
    (telemetryUncertain ? 0.25 : 0) +
    (partialFailure ? 0.15 : 0) +
    (interruptedRecovery ? 0.12 : 0) +
    (interruptedRegulation ? 0.1 : 0)

  const continuityConfidence = clamp01(
    snapshot.continuityConfidence * 0.55 +
      snapshot.continuityState.confidenceOfDirection * 0.25 +
      snapshot.equilibriumState.trustStability * 0.2 -
      confidencePenalty,
  )

  let decision: ResumeDecision = "resume"
  let reason = "Direction and trust are stable, so momentum can continue naturally."

  if (telemetryUncertain || continuityConfidence < 0.4) {
    decision = "stabilize"
    reason = "Continuity confidence is low, so we should re-enter conservatively."
  } else if (interruptedRecovery || unstableMode) {
    decision = "recover"
    reason = "The previous session ended in an unstable mode and needs guided recovery."
  } else if (overloadRisk || gapMs > 24 * 60 * 60 * 1000 || interruptionCause === "api_failure") {
    decision = "simplify"
    reason = "The re-entry context suggests reduced complexity for safer continuity."
  } else if (!highMomentum || interruptionCause === "websocket_disconnect" || interruptionCause === "browser_crash") {
    decision = "resume"
    reason = "Session continuity is healthy enough to resume without major changes."
  }

  const nextSnapshot = createSessionSnapshot({
    userId: snapshot.userId,
    timestamp: now,
    equilibriumState: {
      mode:
        decision === "recover"
          ? "recovery"
          : decision === "stabilize"
            ? "stabilizing"
            : decision === "simplify"
              ? "balanced"
              : snapshot.equilibriumState.mode,
      fatigueRisk:
        decision === "resume"
          ? snapshot.equilibriumState.fatigueRisk
          : clamp01(snapshot.equilibriumState.fatigueRisk * 0.85),
      trustStability:
        decision === "resume"
          ? snapshot.equilibriumState.trustStability
          : clamp01(snapshot.equilibriumState.trustStability * 0.98 + 0.02),
      momentum:
        decision === "resume"
          ? clamp01(snapshot.equilibriumState.momentum * 0.98 + 0.02)
          : clamp01(snapshot.equilibriumState.momentum * 0.82),
    },
    workspaceState: {
      density:
        decision === "resume"
          ? snapshot.workspaceState.density
          : decision === "simplify"
            ? "light"
            : "focused",
      activeModules:
        decision === "resume"
          ? snapshot.workspaceState.activeModules
          : snapshot.workspaceState.activeModules.slice(0, Math.max(1, Math.ceil(snapshot.workspaceState.activeModules.length / 2))),
      hiddenModules:
        decision === "resume"
          ? snapshot.workspaceState.hiddenModules
          : Array.from(
              new Set([
                ...snapshot.workspaceState.hiddenModules,
                ...snapshot.workspaceState.activeModules.slice(
                  Math.max(1, Math.ceil(snapshot.workspaceState.activeModules.length / 2)),
                ),
              ]),
            ),
    },
    continuityState: {
      activeTrajectory: snapshot.continuityState.activeTrajectory,
      lastMeaningfulAction: snapshot.continuityState.lastMeaningfulAction,
      interruptedFlow: snapshot.continuityState.interruptedFlow,
      confidenceOfDirection:
        decision === "resume"
          ? clamp01(snapshot.continuityState.confidenceOfDirection * 0.99 + 0.01)
          : clamp01(snapshot.continuityState.confidenceOfDirection * 0.9),
    },
    recoveryState: {
      activeRecoveryStrategy:
        decision === "recover"
          ? "guided_reentry"
          : decision === "stabilize"
            ? "confidence_rebuild"
            : snapshot.recoveryState.activeRecoveryStrategy,
      recoveryProgress:
        decision === "recover" || decision === "stabilize"
          ? clamp01(snapshot.recoveryState.recoveryProgress ?? 0.2)
          : snapshot.recoveryState.recoveryProgress,
    },
    notificationState: {
      cadence:
        decision === "resume"
          ? snapshot.notificationState.cadence
          : decision === "simplify"
            ? "gentle"
            : "protective",
      suppressionLevel:
        decision === "resume"
          ? snapshot.notificationState.suppressionLevel
          : decision === "simplify"
            ? "high"
            : "critical",
    },
    continuityConfidence,
  })

  return {
    decision,
    continuityConfidence,
    reason,
    recommendedPacing:
      decision === "resume" ? "steady" : decision === "simplify" ? "gentle" : "conservative",
    nextSnapshot,
  }
}

export async function reconcileAndPersistSessionResume(params: {
  userId: string
  interruptionCause?: InterruptionCauseType
  now?: number
}): Promise<PersistedSessionResumePlan | null> {
  const record = await loadSessionContinuityRecord(params.userId)
  const snapshot = record.latestStableSnapshot

  if (!snapshot) {
    return null
  }

  const now = Number(params.now ?? Date.now())
  const mutationKey = buildMutationKey(params.userId, now, params.interruptionCause)
  const plan = reconcileSessionResume({
    snapshot,
    interruptionCause: params.interruptionCause,
    now,
  })

  if (params.interruptionCause) {
    await appendInterruptionCause(
      params.userId,
      {
        timestamp: now,
        cause: params.interruptionCause,
      },
      { mutationKey: `${mutationKey}:interrupt` },
    )
  }

  await appendRecoveryCheckpoint(
    params.userId,
    {
      timestamp: now,
      snapshot: plan.nextSnapshot,
      strategy: plan.decision,
      progress: plan.nextSnapshot.recoveryState.recoveryProgress,
    },
    { mutationKey: `${mutationKey}:checkpoint` },
  )

  await appendRecoveryHistory(
    params.userId,
    {
      timestamp: now,
      phase: plan.decision,
      strategy: plan.nextSnapshot.recoveryState.activeRecoveryStrategy ?? plan.decision,
      confidence: plan.continuityConfidence,
      note: plan.reason,
    },
    { mutationKey: `${mutationKey}:history` },
  )

  return {
    ...plan,
    mutationKey,
  }
}
