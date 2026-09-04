import type { EquilibriumEvent } from "@/lib/telemetry/equilibriumEventStream"
import {
  computePersonalEquilibriumProfile,
  type EquilibriumObservation,
} from "@/lib/personalization/equilibriumProfile"
import { learnBehavioralRhythm, type RhythmSignal } from "@/lib/personalization/rhythmLearning"
import {
  learnPersonalizedRecoveryProfile,
  type RecoveryObservation,
} from "@/lib/personalization/recoveryProfiles"
import { computeAdaptiveTrustModel, type TrustSignal } from "@/lib/personalization/trustContinuity"
import {
  buildEquilibriumIdentity,
  identityChanged,
} from "@/lib/personalization/equilibriumIdentity"
import {
  loadPersonalizationStates,
  savePersonalizationStates,
  type UserPersonalizationState,
} from "@/lib/personalization/personalizationStore"
import { appendIdentityDriftAlert } from "@/lib/personalization/identityDriftAlerts"

const MAX_HISTORY = 1_200

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function workspaceDensityFromEvent(event: EquilibriumEvent): number {
  const metadataValue = event.metadata?.workspaceDensity
  if (typeof metadataValue === "number") {
    return clamp01(metadataValue)
  }

  const mode = typeof event.metadata?.workspaceMode === "string" ? event.metadata.workspaceMode : null
  if (mode === "expanded") return 0.8
  if (mode === "focused") return 0.45
  if (mode === "recovery") return 0.35
  if (mode === "continuity") return 0.4
  return 0.6
}

function toEquilibriumObservation(event: EquilibriumEvent): EquilibriumObservation {
  const completedActions = typeof event.metadata?.completedActions === "number" ? event.metadata.completedActions : 1
  const abandonedActions = typeof event.metadata?.abandonedActions === "number" ? event.metadata.abandonedActions : 0

  return {
    timestamp: event.timestamp,
    pressureLevel: clamp01(event.pressureLevel),
    fatigueRisk: clamp01(event.fatigueRisk),
    workspaceDensity: workspaceDensityFromEvent(event),
    interruptions:
      typeof event.metadata?.interruptions === "number"
        ? Math.max(0, event.metadata.interruptions)
        : event.eventType === "notification_suppression"
          ? 0
          : 1,
    recoveryDurationMs:
      typeof event.metadata?.recoveryDurationMs === "number"
        ? Math.max(0, event.metadata.recoveryDurationMs)
        : event.recoveryTriggered
          ? 2 * 60 * 60 * 1000
          : 0,
    completedActions: Math.max(0, completedActions),
    abandonedActions: Math.max(0, abandonedActions),
  }
}

function toRhythmSignal(event: EquilibriumEvent): RhythmSignal {
  const completed = typeof event.metadata?.completedActions === "number" ? event.metadata.completedActions : 1
  const abandoned = typeof event.metadata?.abandonedActions === "number" ? event.metadata.abandonedActions : 0

  return {
    timestamp: event.timestamp,
    actionsCompleted: Math.max(0, completed),
    actionsAbandoned: Math.max(0, abandoned),
    fatigueRisk: clamp01(event.fatigueRisk),
    pressureLevel: clamp01(event.pressureLevel),
    recovered:
      event.eventType === "recovery_activation" ||
      (event.recoveryTriggered && (event.nextState === "stabilizing" || event.nextState === "balanced")),
  }
}

function toRecoveryObservation(event: EquilibriumEvent): RecoveryObservation {
  return {
    timestamp: event.timestamp,
    fatigueRisk: clamp01(event.fatigueRisk),
    pressureLevel: clamp01(event.pressureLevel),
    recoveryDurationMs:
      typeof event.metadata?.recoveryDurationMs === "number"
        ? Math.max(0, event.metadata.recoveryDurationMs)
        : event.recoveryTriggered
          ? 2 * 60 * 60 * 1000
          : 0,
    notificationReductionApplied:
      event.eventType === "notification_suppression" ||
      event.metadata?.notificationMode === "quiet" ||
      event.metadata?.reduceNotifications === true,
    reassuranceApplied:
      event.metadata?.reassuranceApplied === true || event.metadata?.reassuranceTone === "supportive",
    simplificationApplied:
      event.eventType === "workspace_contraction" || event.metadata?.simplificationApplied === true,
    pacingSlowdownApplied:
      event.eventType === "cadence_downshift" || event.metadata?.pacingSlowdownApplied === true,
    stabilized:
      event.nextState === "stabilizing" || event.nextState === "balanced" || event.metadata?.stabilized === true,
  }
}

function toTrustSignal(event: EquilibriumEvent): TrustSignal {
  const trustFeedback =
    typeof event.metadata?.trustFeedback === "number"
      ? clamp01(event.metadata.trustFeedback)
      : clamp01(0.6 - event.fatigueRisk * 0.3 + (event.recoveryTriggered ? 0.08 : 0))

  return {
    timestamp: event.timestamp,
    continuityPreserved: event.eventType === "continuity_safeguard" || event.metadata?.continuityMaintained === true,
    overrideRejected: event.metadata?.overrideRejected === true,
    adaptationAccepted: event.metadata?.adaptationAccepted !== false,
    trustFeedback,
    recoveryStabilized:
      event.eventType === "recovery_activation" ||
      event.nextState === "stabilizing" ||
      event.nextState === "balanced" ||
      event.metadata?.stabilized === true,
  }
}

function recomputeUserState(userId: string, history: EquilibriumEvent[], now = Date.now()): UserPersonalizationState {
  const ordered = history
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_HISTORY)

  const profile = computePersonalEquilibriumProfile(ordered.map(toEquilibriumObservation), now)
  const rhythm = learnBehavioralRhythm(ordered.map(toRhythmSignal), now)
  const recovery = learnPersonalizedRecoveryProfile(ordered.map(toRecoveryObservation), now)
  const trust = computeAdaptiveTrustModel(ordered.map(toTrustSignal), now)
  const identity = buildEquilibriumIdentity({
    profile,
    rhythm,
    recovery,
    trust,
    now,
  })

  return {
    userId,
    eventHistory: ordered,
    profile,
    rhythm,
    recovery,
    trust,
    identity,
    updatedAt: now,
  }
}

export async function ingestPersonalizationEvents(events: EquilibriumEvent[]) {
  if (events.length === 0) {
    return [] as UserPersonalizationState[]
  }

  const states = await loadPersonalizationStates()
  const grouped = new Map<string, EquilibriumEvent[]>()
  for (const event of events) {
    const list = grouped.get(event.userId) ?? []
    list.push(event)
    grouped.set(event.userId, list)
  }

  const updated: UserPersonalizationState[] = []
  for (const [userId, userEvents] of grouped.entries()) {
    const previousState = states[userId]
    const previous = previousState?.eventHistory ?? []
    const nextState = recomputeUserState(userId, previous.concat(userEvents))

    if (previousState) {
      const drift = identityChanged(previousState.identity, nextState.identity)
      if (drift.changed && drift.delta >= 0.45) {
        await appendIdentityDriftAlert({
          userId,
          delta: drift.delta,
          previousFingerprint: previousState.identity.fingerprint,
          nextFingerprint: nextState.identity.fingerprint,
          summary: `Identity drift detected (${(drift.delta * 100).toFixed(1)}% delta)` ,
        })
      }
    }

    states[userId] = nextState
    updated.push(nextState)
  }

  await savePersonalizationStates(states)
  return updated
}
