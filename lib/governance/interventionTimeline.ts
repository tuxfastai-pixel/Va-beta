import { listGovernanceInterventions } from "./governanceInterventionLog.ts"
import { listEquilibriumEvents, type EquilibriumEvent } from "../telemetry/equilibriumEventStream.ts"
import { listIdentityDriftAlerts, type IdentityDriftAlert } from "../personalization/identityDriftAlerts.ts"

type TimelineKind =
  | "drift_event"
  | "intervention"
  | "rollback"
  | "recovery_activation"
  | "equilibrium_transition"

export type InterventionTimelineItem = {
  id: string
  timestamp: number
  kind: TimelineKind
  userId: string | null
  summary: string
  metadata: Record<string, unknown>
}

function severityForDelta(delta: number): "low" | "moderate" | "high" | "critical" {
  if (delta >= 0.75) return "critical"
  if (delta >= 0.6) return "high"
  if (delta >= 0.45) return "moderate"
  return "low"
}

export function buildInterventionTimeline(input: {
  interventions: Awaited<ReturnType<typeof listGovernanceInterventions>>
  equilibriumEvents: EquilibriumEvent[]
  driftAlerts: IdentityDriftAlert[]
  userId?: string | null
  limit?: number
}): InterventionTimelineItem[] {
  const userId = input.userId || null

  const baseTimeline: InterventionTimelineItem[] = [
    ...input.interventions.map((entry) => ({
      id: `gov-${entry.id}`,
      timestamp: entry.timestamp,
      kind: (entry.action.includes("rollback") || entry.action.includes("revert") ? "rollback" : "intervention") as
        | "rollback"
        | "intervention",
      userId: typeof entry.metadata?.userId === "string" ? entry.metadata.userId : null,
      summary: entry.rationale,
      metadata: { action: entry.action, actor: entry.actor },
    })),
    ...input.equilibriumEvents
      .filter((event) => event.recoveryTriggered)
      .map((event) => ({
        id: `recovery-${event.userId}-${event.timestamp}`,
        timestamp: event.timestamp,
        kind: "recovery_activation" as const,
        userId: event.userId,
        summary: `Recovery activated from ${event.previousState} to ${event.nextState}`,
        metadata: { eventType: event.eventType },
      })),
    ...input.equilibriumEvents
      .filter((event) => event.previousState !== event.nextState)
      .map((event) => ({
        id: `transition-${event.userId}-${event.timestamp}`,
        timestamp: event.timestamp,
        kind: "equilibrium_transition" as const,
        userId: event.userId,
        summary: `Equilibrium transition ${event.previousState} -> ${event.nextState}`,
        metadata: { eventType: event.eventType },
      })),
    ...input.driftAlerts.map((alert) => ({
      id: `drift-${alert.id}`,
      timestamp: alert.timestamp,
      kind: "drift_event" as const,
      userId: alert.userId,
      summary: `${alert.summary} (${Math.round(alert.delta * 100)}%)`,
      metadata: { delta: alert.delta, severity: severityForDelta(alert.delta) },
    })),
  ]

  const filtered = userId
    ? baseTimeline.filter((item) => !item.userId || item.userId === userId)
    : baseTimeline

  const limit = Math.max(20, input.limit ?? 200)
  return filtered.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
}

export async function listInterventionTimeline(options?: {
  userId?: string
  timelineLimit?: number
  alertsLimit?: number
}) {
  const interventions = await listGovernanceInterventions(500)
  const equilibriumEvents = await listEquilibriumEvents({ limit: 5_000 })
  const driftAlerts = await listIdentityDriftAlerts({
    userId: options?.userId,
    limit: options?.alertsLimit ?? 200,
  })

  return buildInterventionTimeline({
    interventions,
    equilibriumEvents,
    driftAlerts,
    userId: options?.userId,
    limit: options?.timelineLimit,
  })
}
