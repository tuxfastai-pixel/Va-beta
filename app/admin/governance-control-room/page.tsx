"use client"

import { useEffect, useMemo, useState } from "react"

type GovernanceControlRoomSnapshot = {
  generatedAt: string
  globalPosture: {
    operationalMode: string
    safeMode: boolean
    forceBalancedMode: boolean
    quietNotifications: boolean
  }
  systemAutonomyHealth: {
    activeAutonomyTiers: Record<string, number>
    throttledUsers: number
    rollbackRiskDistribution: { low: number; medium: number; high: number }
    invariantInterventionRate: number
    recoveryActivationRate: number
    shadowModeDivergence: number
  }
  userStabilityGrid: Array<{
    userId: string
    trustRegime: string
    autonomyTier: string
    rollbackRisk: number
    continuityConfidence: number
    pacingState: string
    behavioralDriftIndicators: {
      trustVolatility: number
      interventionDensity: number
    }
    adaptiveRiskForecast: {
      overloadLikelihood: number
    }
  }>
  invariantViolationsTimeline: Array<{
    id: string
    timestamp: number
    invariantId: string
    userId: string | null
    severity: string
    affectedAction: string
    resultingAction: string
  }>
  autonomyDecisionReplay: Array<{
    id: string
    timestamp: number
    userId: string
    decision: string
    reason: string
  }>
  shadowLiveDivergence: {
    divergenceRate: number
  }
}

type GovernanceOperationsSnapshot = {
  generatedAt: number
  interventionQueue: Array<{
    id: string
    timestamp: number
    userId: string | null
    severity: "low" | "medium" | "high"
    summary: string
    status: "pending" | "acknowledged"
  }>
  anomalyEscalationWorkflow: Array<{
    id: string
    timestamp: number
    stage: "detected" | "triaged" | "approved" | "executed"
    reason: string
    actor: string
  }>
  governanceApprovals: Array<{
    id: string
    timestamp: number
    stage: "detected" | "triaged" | "approved" | "executed"
    reason: string
    actor: string
  }>
  rollbackApprovalChain: Array<{
    id: string
    timestamp: number
    userId: string | null
    rationale: string
    approved: boolean
  }>
  trustDegradationAlerts: Array<{
    userId: string
    trustRegime: string
    trustMomentum: number
    continuityTrustScore: number
    severity: "watch" | "critical"
  }>
  adaptiveFreezeControls: {
    freezeRecommended: boolean
    reason: string | null
  }
  queueInfrastructure: {
    governanceEvents: { queued: number; processing: number; deadLettered: number }
    telemetryBatch: { queued: number; processing: number; deadLettered: number }
    replayIndex: { queued: number; processing: number; deadLettered: number }
    orchestrationRetry: { queued: number; processing: number; deadLettered: number }
  }
  regulatoryLogs: Array<{
    id: string
    timestamp: number
    actor: string
    action: string
    rationale: string
  }>
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

type QuickAction = {
  key: string
  label: string
  payload: Record<string, unknown>
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "freeze-rollout",
    label: "Freeze rollout",
    payload: {
      reason: "governance-control-room:freeze-rollout",
      rolloutPolicy: { enabled: false },
      personalizationRolloutPolicy: { enabled: false },
    },
  },
  {
    key: "force-balanced",
    label: "Force balanced mode",
    payload: {
      reason: "governance-control-room:force-balanced",
      forceBalancedMode: true,
      operationalMode: "regulated_autonomy",
    },
  },
  {
    key: "disable-autonomy",
    label: "Disable autonomy",
    payload: {
      reason: "governance-control-room:disable-autonomy",
      disableOrchestration: true,
      disableAdaptiveWorkspace: true,
      disableAutonomousPacing: true,
      operationalMode: "assistive_only",
    },
  },
  {
    key: "quiet-notifications",
    label: "Quiet all notifications",
    payload: {
      reason: "governance-control-room:quiet-notifications",
      forceQuietNotifications: true,
    },
  },
  {
    key: "recovery-only",
    label: "Recovery-only mode",
    payload: {
      reason: "governance-control-room:recovery-only",
      safeMode: true,
      forceBalancedMode: true,
      disableOrchestration: true,
      disableAutonomousPacing: true,
      operationalMode: "recovery_priority",
      rolloutPolicy: { enabled: true, mode: "recovery-only", percentage: 100 },
    },
  },
  {
    key: "shadow-only",
    label: "Shadow-only mode",
    payload: {
      reason: "governance-control-room:shadow-only",
      operationalMode: "shadow_only",
      rolloutPolicy: { enabled: true, mode: "shadow-mode", percentage: 100 },
      personalizationRolloutPolicy: { enabled: true, mode: "shadow-mode", percentage: 100 },
    },
  },
  {
    key: "emergency-rollback",
    label: "Emergency rollback",
    payload: {
      reason: "governance-control-room:emergency-rollback",
      emergencyRollback: true,
      safeMode: true,
      forceBalancedMode: true,
      disableOrchestration: true,
      disableAdaptiveWorkspace: true,
      disableAutonomousPacing: true,
      forceQuietNotifications: true,
      operationalMode: "recovery_priority",
    },
  },
]

export default function GovernanceControlRoomPage() {
  const [snapshot, setSnapshot] = useState<GovernanceControlRoomSnapshot | null>(null)
  const [opsSnapshot, setOpsSnapshot] = useState<GovernanceOperationsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<string, "idle" | "saving" | "done" | "error">>({})
  const [exportingAudit, setExportingAudit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const continuityRisk = useMemo(() => {
    if (!snapshot) {
      return 0
    }

    const values = snapshot.userStabilityGrid.map((item) => 1 - item.continuityConfidence)
    if (values.length <= 0) {
      return 0
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }, [snapshot])

  const overloadForecast = useMemo(() => {
    if (!snapshot) {
      return 0
    }
    const values = snapshot.userStabilityGrid.map((item) => item.adaptiveRiskForecast.overloadLikelihood)
    if (values.length <= 0) {
      return 0
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }, [snapshot])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [auditResponse, opsResponse] = await Promise.all([
          fetch("/api/admin/autonomy-audit?limit=80"),
          fetch("/api/admin/governance-operations?limit=80"),
        ])

        if (!auditResponse.ok || !opsResponse.ok) {
          throw new Error("Failed to load governance control room snapshot")
        }

        const payload = (await auditResponse.json()) as { snapshot?: GovernanceControlRoomSnapshot }
        const opsPayload = (await opsResponse.json()) as { snapshot?: GovernanceOperationsSnapshot }
        if (active) {
          setSnapshot(payload.snapshot ?? null)
          setOpsSnapshot(opsPayload.snapshot ?? null)
          setError(null)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unknown governance control room error")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()
    const timer = setInterval(() => {
      void load()
    }, 30000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  async function executeAction(action: QuickAction) {
    setActionState((prev) => ({ ...prev, [action.key]: "saving" }))
    try {
      const response = await fetch("/api/admin/safety-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      })

      if (!response.ok) {
        throw new Error(`Action failed: ${action.label}`)
      }

      setActionState((prev) => ({ ...prev, [action.key]: "done" }))
    } catch {
      setActionState((prev) => ({ ...prev, [action.key]: "error" }))
    }
  }

  async function exportAuditBundle() {
    setExportingAudit(true)
    try {
      const response = await fetch("/api/admin/governance-operations?export=1&limit=200")
      if (!response.ok) {
        throw new Error("Failed to export governance audit bundle")
      }
      setError(null)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Audit export failed")
    } finally {
      setExportingAudit(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Governance Control Room</p>
          <h1 className="mt-3 text-3xl font-semibold">Live Adaptive Governance Command Center</h1>
          <p className="mt-2 text-sm text-slate-300">
            Operational command center for trust heat, autonomy risk, intervention pressure, shadow divergence,
            and invariant enforcement.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {snapshot ? `Last update: ${new Date(snapshot.generatedAt).toLocaleString()}` : "Waiting for snapshot"}
          </p>
          {snapshot && (
            <p className="mt-1 text-xs text-slate-400">
              Mode: {snapshot.globalPosture.operationalMode} • safe={String(snapshot.globalPosture.safeMode)} • balanced={String(snapshot.globalPosture.forceBalancedMode)}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
        </header>

        {loading || !snapshot ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            Loading governance telemetry...
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Trust regime heat</p>
                <p className="mt-2 text-2xl font-bold">{percent(1 - continuityRisk)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Autonomy tiers active</p>
                <p className="mt-2 text-2xl font-bold">{Object.values(snapshot.systemAutonomyHealth.activeAutonomyTiers).reduce((sum, value) => sum + value, 0)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Recovery activations</p>
                <p className="mt-2 text-2xl font-bold text-cyan-300">{percent(snapshot.systemAutonomyHealth.recoveryActivationRate)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Invariant interventions</p>
                <p className="mt-2 text-2xl font-bold text-red-300">{snapshot.invariantViolationsTimeline.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Shadow divergence</p>
                <p className="mt-2 text-2xl font-bold text-fuchsia-300">{percent(snapshot.shadowLiveDivergence.divergenceRate)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Cognitive overload forecast</p>
                <p className="mt-2 text-2xl font-bold text-amber-300">{percent(overloadForecast)}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold">Operational Controls</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {QUICK_ACTIONS.map((action) => {
                  const status = actionState[action.key] ?? "idle"
                  return (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => {
                        void executeAction(action)
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-left text-sm text-slate-100"
                      disabled={status === "saving"}
                    >
                      <p className="font-semibold">{action.label}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {status === "saving" ? "Applying..." : status === "done" ? "Applied" : status === "error" ? "Failed" : "Ready"}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    void exportAuditBundle()
                  }}
                  className="rounded-lg border border-cyan-700 bg-cyan-950 px-3 py-2 text-sm text-cyan-100"
                  disabled={exportingAudit}
                >
                  {exportingAudit ? "Exporting..." : "Export audit + regulatory bundle"}
                </button>
              </div>
            </section>

            {opsSnapshot && (
              <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold">Real-Time Intervention Queue</h2>
                  <div className="mt-4 space-y-3">
                    {opsSnapshot.interventionQueue.slice(0, 12).map((item) => (
                      <article key={item.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                        <p className="font-semibold text-slate-100">{item.summary}</p>
                        <p className="text-xs text-slate-400">{item.severity} • {item.status} • {item.userId ?? "global"}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold">Anomaly Escalation Workflow</h2>
                  <div className="mt-4 space-y-3">
                    {opsSnapshot.anomalyEscalationWorkflow.slice(0, 12).map((item) => (
                      <article key={item.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                        <p className="font-semibold text-amber-200">{item.stage.toUpperCase()}</p>
                        <p className="text-slate-300">{item.reason}</p>
                        <p className="text-xs text-slate-500">{item.actor} • {new Date(item.timestamp).toLocaleString()}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold">Governance & Rollback Approvals</h2>
                  <div className="mt-4 space-y-3">
                    {opsSnapshot.governanceApprovals.slice(0, 8).map((item) => (
                      <article key={item.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                        <p className="font-semibold text-cyan-200">{item.stage}</p>
                        <p className="text-slate-300">{item.reason}</p>
                      </article>
                    ))}
                    {opsSnapshot.rollbackApprovalChain.slice(0, 8).map((item) => (
                      <article key={`rollback-${item.id}`} className="rounded-lg border border-slate-800 p-3 text-sm">
                        <p className="font-semibold text-rose-200">rollback • {item.approved ? "approved" : "pending"}</p>
                        <p className="text-slate-300">{item.rationale}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold">Trust Degradation Alerts</h2>
                  <div className="mt-4 space-y-3">
                    {opsSnapshot.trustDegradationAlerts.slice(0, 12).map((alert) => (
                      <article key={alert.userId} className="rounded-lg border border-slate-800 p-3 text-sm">
                        <p className="font-semibold text-amber-100">{alert.userId}</p>
                        <p className="text-slate-300">regime {alert.trustRegime} • momentum {alert.trustMomentum.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">continuity {percent(alert.continuityTrustScore)} • {alert.severity}</p>
                      </article>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Adaptive freeze: {opsSnapshot.adaptiveFreezeControls.freezeRecommended ? "recommended" : "not required"}
                    {opsSnapshot.adaptiveFreezeControls.reason ? ` • ${opsSnapshot.adaptiveFreezeControls.reason}` : ""}
                  </p>
                </section>
              </section>
            )}

            {opsSnapshot && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-lg font-semibold">Queue Infrastructure + Regulatory Log</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-slate-800 p-3 text-sm">
                    <p className="font-semibold">Governance Events Queue</p>
                    <p className="text-slate-400">queued {opsSnapshot.queueInfrastructure.governanceEvents.queued} • processing {opsSnapshot.queueInfrastructure.governanceEvents.processing} • dlq {opsSnapshot.queueInfrastructure.governanceEvents.deadLettered}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3 text-sm">
                    <p className="font-semibold">Telemetry Batch Queue</p>
                    <p className="text-slate-400">queued {opsSnapshot.queueInfrastructure.telemetryBatch.queued} • processing {opsSnapshot.queueInfrastructure.telemetryBatch.processing} • dlq {opsSnapshot.queueInfrastructure.telemetryBatch.deadLettered}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3 text-sm">
                    <p className="font-semibold">Replay Index Queue</p>
                    <p className="text-slate-400">queued {opsSnapshot.queueInfrastructure.replayIndex.queued} • processing {opsSnapshot.queueInfrastructure.replayIndex.processing} • dlq {opsSnapshot.queueInfrastructure.replayIndex.deadLettered}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3 text-sm">
                    <p className="font-semibold">Orchestration Retry Queue</p>
                    <p className="text-slate-400">queued {opsSnapshot.queueInfrastructure.orchestrationRetry.queued} • processing {opsSnapshot.queueInfrastructure.orchestrationRetry.processing} • dlq {opsSnapshot.queueInfrastructure.orchestrationRetry.deadLettered}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {opsSnapshot.regulatoryLogs.slice(0, 10).map((entry) => (
                    <p key={entry.id} className="text-xs text-slate-400">
                      {new Date(entry.timestamp).toLocaleString()} • {entry.actor} • {entry.action} • {entry.rationale}
                    </p>
                  ))}
                </div>
              </section>
            )}

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-lg font-semibold">Intervention Timeline</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.invariantViolationsTimeline.slice(0, 12).map((item) => (
                    <article key={item.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                      <p className="font-semibold text-red-300">{item.invariantId}</p>
                      <p className="text-slate-300">{item.affectedAction} {"->"} {item.resultingAction}</p>
                      <p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()} • {item.userId ?? "global"}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-lg font-semibold">Drift Alerts & Rollback Predictions</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.userStabilityGrid.slice(0, 12).map((item) => (
                    <article key={item.userId} className="rounded-lg border border-slate-800 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-100">{item.userId}</p>
                        <p className="text-xs text-slate-400">{item.autonomyTier}</p>
                      </div>
                      <p className="mt-1 text-slate-300">rollback {percent(item.rollbackRisk)} • continuity {percent(item.continuityConfidence)}</p>
                      <p className="text-xs text-slate-500">
                        drift {percent(item.behavioralDriftIndicators.trustVolatility)} • intervention density {percent(item.behavioralDriftIndicators.interventionDensity)}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold">Autonomy Decision Replay</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-3 pr-4">When</th>
                      <th className="pb-3 pr-4">User</th>
                      <th className="pb-3 pr-4">Decision</th>
                      <th className="pb-3 pr-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.autonomyDecisionReplay.slice(0, 20).map((item) => (
                      <tr key={item.id} className="border-t border-slate-800 align-top">
                        <td className="py-3 pr-4 text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</td>
                        <td className="py-3 pr-4">{item.userId}</td>
                        <td className="py-3 pr-4">{item.decision}</td>
                        <td className="py-3 pr-4 text-slate-300">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
