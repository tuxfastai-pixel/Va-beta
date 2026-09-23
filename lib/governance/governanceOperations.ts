import { listInterventionTimeline } from "./interventionTimeline.ts"
import { listGovernanceInterventions } from "./governanceInterventionLog.ts"
import { listTrustHistoryRecords, summarizeTrustHistory } from "../trust/trustHistoryStore.ts"
import { getQueueSnapshot } from "../runtime/productionQueueInfrastructure.ts"

export type GovernanceInterventionQueueItem = {
  id: string
  timestamp: number
  userId: string | null
  severity: "low" | "medium" | "high"
  summary: string
  status: "pending" | "acknowledged"
}

export type GovernanceEscalationWorkflowItem = {
  id: string
  timestamp: number
  stage: "detected" | "triaged" | "approved" | "executed"
  reason: string
  actor: string
}

export type RollbackApprovalItem = {
  id: string
  timestamp: number
  userId: string | null
  rationale: string
  approved: boolean
}

export type TrustDegradationAlert = {
  userId: string
  trustRegime: string
  trustMomentum: number
  continuityTrustScore: number
  severity: "watch" | "critical"
}

export type GovernanceOperationsSnapshot = {
  generatedAt: number
  interventionQueue: GovernanceInterventionQueueItem[]
  anomalyEscalationWorkflow: GovernanceEscalationWorkflowItem[]
  governanceApprovals: GovernanceEscalationWorkflowItem[]
  rollbackApprovalChain: RollbackApprovalItem[]
  trustDegradationAlerts: TrustDegradationAlert[]
  adaptiveFreezeControls: {
    freezeRecommended: boolean
    reason: string | null
  }
  queueInfrastructure: {
    governanceEvents: Awaited<ReturnType<typeof getQueueSnapshot>>
    telemetryBatch: Awaited<ReturnType<typeof getQueueSnapshot>>
    replayIndex: Awaited<ReturnType<typeof getQueueSnapshot>>
    orchestrationRetry: Awaited<ReturnType<typeof getQueueSnapshot>>
  }
  regulatoryLogs: Array<{
    id: string
    timestamp: number
    actor: string
    action: string
    rationale: string
  }>
}

function severityForSummary(summary: string): "low" | "medium" | "high" {
  const lower = summary.toLowerCase()
  if (lower.includes("critical") || lower.includes("rollback") || lower.includes("emergency")) return "high"
  if (lower.includes("drift") || lower.includes("recovery")) return "medium"
  return "low"
}

export async function buildGovernanceOperationsSnapshot(limit = 80): Promise<GovernanceOperationsSnapshot> {
  const [timeline, interventions, trustRecords, governanceEvents, telemetryBatch, replayIndex, orchestrationRetry] = await Promise.all([
    listInterventionTimeline({ timelineLimit: limit }),
    listGovernanceInterventions(limit * 3),
    listTrustHistoryRecords(limit),
    getQueueSnapshot("governance-events"),
    getQueueSnapshot("telemetry-batch"),
    getQueueSnapshot("replay-index"),
    getQueueSnapshot("orchestration-retry"),
  ])

  const interventionQueue = timeline
    .filter((entry) => entry.kind === "drift_event" || entry.kind === "intervention" || entry.kind === "rollback")
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      userId: entry.userId,
      severity: severityForSummary(entry.summary),
      summary: entry.summary,
      status: "pending" as const,
    }))

  const anomalyEscalationWorkflow: GovernanceEscalationWorkflowItem[] = interventions
    .filter((entry) => /critical|drift|escalation|recovery|rollback/i.test(entry.rationale))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      stage: /approved/i.test(entry.rationale)
        ? "approved"
        : /rollback|executed/i.test(entry.action)
          ? "executed"
          : /review|triage/i.test(entry.rationale)
            ? "triaged"
            : "detected",
      reason: entry.rationale,
      actor: entry.actor,
    }))

  const governanceApprovals: GovernanceEscalationWorkflowItem[] = interventions
    .filter((entry) => /approval|approved|manual review/i.test(entry.rationale))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      stage: /approved/i.test(entry.rationale) ? "approved" : "triaged",
      reason: entry.rationale,
      actor: entry.actor,
    }))

  const rollbackApprovalChain = interventions
    .filter((entry) => /rollback/i.test(entry.action) || /rollback/i.test(entry.rationale))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      userId: typeof entry.metadata?.userId === "string" ? entry.metadata.userId : null,
      rationale: entry.rationale,
      approved: /approval|approved/i.test(entry.rationale),
    }))

  const trustDegradationAlerts = trustRecords
    .map((record) => {
      const summary = summarizeTrustHistory(record)
      return {
        userId: record.userId,
        trustRegime: summary.trustRegime,
        trustMomentum: summary.trustMomentum,
        continuityTrustScore: summary.latestMetrics?.continuityTrustScore ?? 0,
      }
    })
    .filter((item) => item.trustRegime === "guarded" || item.trustMomentum < -0.08 || item.continuityTrustScore < 0.45)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      severity: item.trustRegime === "guarded" || item.trustMomentum < -0.15 ? "critical" as const : "watch" as const,
    }))

  const freezeRecommended =
    trustDegradationAlerts.some((alert) => alert.severity === "critical") ||
    interventionQueue.filter((item) => item.severity === "high").length >= 5

  return {
    generatedAt: Date.now(),
    interventionQueue,
    anomalyEscalationWorkflow,
    governanceApprovals,
    rollbackApprovalChain,
    trustDegradationAlerts,
    adaptiveFreezeControls: {
      freezeRecommended,
      reason: freezeRecommended ? "critical trust degradation and/or high-risk intervention volume" : null,
    },
    queueInfrastructure: {
      governanceEvents,
      telemetryBatch,
      replayIndex,
      orchestrationRetry,
    },
    regulatoryLogs: interventions.slice(0, limit).map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      actor: entry.actor,
      action: entry.action,
      rationale: entry.rationale,
    })),
  }
}

export async function exportGovernanceAuditBundle(limit = 200): Promise<{
  generatedAt: number
  operations: GovernanceOperationsSnapshot
}> {
  const operations = await buildGovernanceOperationsSnapshot(limit)
  return {
    generatedAt: Date.now(),
    operations,
  }
}
