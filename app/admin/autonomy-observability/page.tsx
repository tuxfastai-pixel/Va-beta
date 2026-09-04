"use client"

import { useEffect, useState } from "react"

type AutonomyAuditSnapshot = {
  generatedAt: string
  filters: {
    userId: string | null
    tier: string | null
  }
  globalPosture: {
    operationalMode: string
    safeMode: boolean
    forceBalancedMode: boolean
    quietNotifications: boolean
  }
  systemAutonomyHealth: {
    activeAutonomyTiers: Record<string, number>
    throttledUsers: number
    rollbackRiskDistribution: {
      low: number
      medium: number
      high: number
    }
    invariantInterventionRate: number
    recoveryActivationRate: number
    shadowModeDivergence: number
  }
  userStabilityGrid: Array<{
    userId: string
    autonomyTier: string
    permissionBoundaryStage: string
    trustRegime: string
    continuityConfidence: number
    rollbackRisk: number
    pacingState: string
    stabilityColor: "stable" | "watch" | "critical"
    behavioralDriftIndicators: {
      interventionDensity: number
      regulationFrequency: number
    }
    currentConstraints: {
      currentRegulationState: string
      activeThrottles: string[]
    }
  }>
  invariantViolationsTimeline: Array<{
    id: string
    timestamp: number
    userId: string | null
    invariantId: string
    affectedAction: string
    resultingAction: string
    overridePossible: boolean
    severity: "high" | "medium"
  }>
  autonomyDecisionReplay: Array<{
    id: string
    timestamp: number
    userId: string
    decision: string
    reason: string
    predictedBenefit: {
      fatigueReduction: number
      trustStabilityGain: number
    }
    predictedTrustImpact: number
    actualObservedOutcome: {
      fatigueOutcome: string
      trustOutcome: string
      rollbackOutcome: string
      recoveryOutcome: string
    }
    source: string
  }>
  shadowLiveDivergence: {
    divergenceRate: number
    trustOutcomeDelta: number
    fatigueOutcomeDelta: number
    recoveryOutcomeDelta: number
    rollbackOutcomeDelta: number
  }
  governanceHeatmap: {
    highInterventionZones: Array<{ zone: string; score: number; summary: string }>
    overloadClusters: Array<{ zone: string; score: number; summary: string }>
    recoveryHotspots: Array<{ zone: string; score: number; summary: string }>
    rollbackProneFlows: Array<{ zone: string; score: number; summary: string }>
    trustInstabilityRegions: Array<{ zone: string; score: number; summary: string }>
  }
  recoveryIntelligenceEffectiveness: {
    byUser: Array<{
      userId: string
      tier: string
      bestStrategies: string[]
      failedStrategies: string[]
    }>
    byTier: Array<{
      tier: string
      bestStrategies: string[]
      failedStrategies: string[]
    }>
  }
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function buildQuery(params: { userId: string; tier: string; limit: string }): string {
  const search = new URLSearchParams()
  if (params.userId.trim()) {
    search.set("userId", params.userId.trim())
  }
  if (params.tier.trim()) {
    search.set("tier", params.tier.trim())
  }
  if (params.limit.trim()) {
    search.set("limit", params.limit.trim())
  }
  const query = search.toString()
  return query ? `/api/admin/autonomy-audit?${query}` : "/api/admin/autonomy-audit"
}

function cardTone(color: "stable" | "watch" | "critical"): string {
  if (color === "critical") {
    return "border-red-500/40 bg-red-950/20"
  }
  if (color === "watch") {
    return "border-amber-500/40 bg-amber-950/20"
  }
  return "border-emerald-500/30 bg-emerald-950/10"
}

export default function AutonomyObservabilityPage() {
  const [snapshot, setSnapshot] = useState<AutonomyAuditSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState("")
  const [tier, setTier] = useState("")
  const [limit, setLimit] = useState("40")

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const response = await fetch(buildQuery({ userId, tier, limit }))
        if (!response.ok) {
          throw new Error("Failed to load autonomy observability snapshot")
        }

        const payload = (await response.json()) as { snapshot?: AutonomyAuditSnapshot }
        if (mounted && payload.snapshot) {
          setSnapshot(payload.snapshot)
          setError(null)
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unknown autonomy observability error")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()
    const timer = setInterval(() => {
      void load()
    }, 30000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [userId, tier, limit])

  async function refreshNow() {
    setLoading(true)
    try {
      const response = await fetch(buildQuery({ userId, tier, limit }))
      if (!response.ok) {
        throw new Error("Failed to load autonomy observability snapshot")
      }
      const payload = (await response.json()) as { snapshot?: AutonomyAuditSnapshot }
      if (payload.snapshot) {
        setSnapshot(payload.snapshot)
        setError(null)
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unknown autonomy observability error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Autonomy Observability</p>
              <h1 className="mt-3 text-3xl font-semibold">Observable Constitutional Autonomy</h1>
            </div>
            <div className="rounded-full border border-cyan-500/40 bg-cyan-900/20 px-3 py-1 text-xs text-cyan-100">
              {loading ? "Refreshing" : "Live"}
            </div>
          </div>

          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Live control room for adaptive autonomy, invariant interventions, decision replay, divergence analytics,
            and recovery intelligence.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Last update: {snapshot ? new Date(snapshot.generatedAt).toLocaleString() : "Waiting for data"}
          </p>
          {snapshot && (
            <p className="mt-1 text-xs text-slate-400">
              Global posture: {snapshot.globalPosture.operationalMode} • safeMode={String(snapshot.globalPosture.safeMode)} •
              balanced={String(snapshot.globalPosture.forceBalancedMode)} • quiet={String(snapshot.globalPosture.quietNotifications)}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="User ID"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <select
              value={tier}
              onChange={(event) => setTier(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="">All tiers</option>
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="progressive">Progressive</option>
              <option value="highly_autonomous">Highly autonomous</option>
            </select>
            <input
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="Limit"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => {
                void refreshNow()
              }}
              className="rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 text-sm font-semibold text-cyan-100"
            >
              Refresh
            </button>
          </div>
        </header>

        {!snapshot ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            Loading autonomy observability snapshot...
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Active tiers</p>
                <p className="mt-2 text-2xl font-bold">{Object.values(snapshot.systemAutonomyHealth.activeAutonomyTiers).reduce((sum, value) => sum + value, 0)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Throttled users</p>
                <p className="mt-2 text-2xl font-bold text-amber-300">{snapshot.systemAutonomyHealth.throttledUsers}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Invariant intervention rate</p>
                <p className="mt-2 text-2xl font-bold text-red-300">{snapshot.systemAutonomyHealth.invariantInterventionRate.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Recovery activation rate</p>
                <p className="mt-2 text-2xl font-bold text-cyan-200">{percent(snapshot.systemAutonomyHealth.recoveryActivationRate)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-400">Shadow divergence</p>
                <p className="mt-2 text-2xl font-bold text-fuchsia-200">{percent(snapshot.systemAutonomyHealth.shadowModeDivergence)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                <p className="text-xs text-slate-400">Rollback distribution</p>
                <p className="mt-2">Low: {snapshot.systemAutonomyHealth.rollbackRiskDistribution.low}</p>
                <p>Medium: {snapshot.systemAutonomyHealth.rollbackRiskDistribution.medium}</p>
                <p>High: {snapshot.systemAutonomyHealth.rollbackRiskDistribution.high}</p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">User Stability Grid</h2>
                  <p className="text-xs text-slate-400">Color-coded live stability</p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {snapshot.userStabilityGrid.map((item) => (
                    <article key={item.userId} className={`rounded-xl border p-4 ${cardTone(item.stabilityColor)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{item.userId}</h3>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{item.autonomyTier}</p>
                        </div>
                        <div className="text-right text-xs text-slate-300">
                          <p>{item.trustRegime}</p>
                          <p>{item.currentConstraints.currentRegulationState}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
                        <div>
                          <p className="text-xs text-slate-400">Boundary</p>
                          <p>{item.permissionBoundaryStage}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Pacing</p>
                          <p>{item.pacingState}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Continuity</p>
                          <p>{percent(item.continuityConfidence)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Rollback</p>
                          <p>{percent(item.rollbackRisk)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Intervention density</p>
                          <p>{percent(item.behavioralDriftIndicators.interventionDensity)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Regulation frequency</p>
                          <p>{percent(item.behavioralDriftIndicators.regulationFrequency)}</p>
                        </div>
                      </div>
                      {item.currentConstraints.activeThrottles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {item.currentConstraints.activeThrottles.map((throttle) => (
                            <span key={throttle} className="rounded-full border border-slate-700 px-2 py-1 text-slate-200">
                              {throttle}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Invariant Violations Timeline</h2>
                    <p className="text-xs text-slate-400">Real-time enforcement feed</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {snapshot.invariantViolationsTimeline.length === 0 ? (
                      <p className="text-sm text-emerald-300">No invariant enforcements recorded.</p>
                    ) : (
                      snapshot.invariantViolationsTimeline.slice(0, 10).map((item) => (
                        <article key={item.id} className="rounded-xl border border-slate-800 p-3 text-sm text-slate-200">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold uppercase tracking-wide text-red-300">{item.invariantId}</p>
                              <p className="mt-1 text-slate-300">{item.affectedAction} {"->"} {item.resultingAction}</p>
                              <p className="text-xs text-slate-500">user: {item.userId ?? "global"}</p>
                            </div>
                            <div className="text-right text-xs text-slate-400">
                              <p>{new Date(item.timestamp).toLocaleString()}</p>
                              <p>severity: {item.severity}</p>
                              <p>override: {item.overridePossible ? "possible" : "blocked"}</p>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold">Shadow vs Live Divergence</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
                    <div className="rounded-xl border border-slate-800 p-3">
                      <p className="text-xs text-slate-400">Divergence</p>
                      <p className="mt-1 font-semibold">{percent(snapshot.shadowLiveDivergence.divergenceRate)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-3">
                      <p className="text-xs text-slate-400">Trust outcome delta</p>
                      <p className="mt-1 font-semibold">{percent(snapshot.shadowLiveDivergence.trustOutcomeDelta)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-3">
                      <p className="text-xs text-slate-400">Fatigue delta</p>
                      <p className="mt-1 font-semibold">{percent(snapshot.shadowLiveDivergence.fatigueOutcomeDelta)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-3">
                      <p className="text-xs text-slate-400">Rollback delta</p>
                      <p className="mt-1 font-semibold">{percent(snapshot.shadowLiveDivergence.rollbackOutcomeDelta)}</p>
                    </div>
                  </div>
                </section>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Autonomy Decision Replay</h2>
                <p className="text-xs text-slate-400">Evidence-driven tuning slice</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-3 pr-4">When</th>
                      <th className="pb-3 pr-4">User</th>
                      <th className="pb-3 pr-4">Decision</th>
                      <th className="pb-3 pr-4">Reason</th>
                      <th className="pb-3 pr-4">Predicted benefit</th>
                      <th className="pb-3 pr-4">Trust impact</th>
                      <th className="pb-3 pr-4">Observed outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.autonomyDecisionReplay.slice(0, 12).map((item) => (
                      <tr key={item.id} className="border-t border-slate-800 align-top">
                        <td className="py-3 pr-4 text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</td>
                        <td className="py-3 pr-4">{item.userId}</td>
                        <td className="py-3 pr-4">{item.decision}</td>
                        <td className="py-3 pr-4 text-slate-300">{item.reason}</td>
                        <td className="py-3 pr-4 text-slate-300">
                          fatigue {percent(item.predictedBenefit.fatigueReduction)} • trust {percent(item.predictedBenefit.trustStabilityGain)}
                        </td>
                        <td className="py-3 pr-4">{percent(item.predictedTrustImpact)}</td>
                        <td className="py-3 pr-4 text-slate-300">
                          {item.actualObservedOutcome.trustOutcome} / {item.actualObservedOutcome.fatigueOutcome} / {item.actualObservedOutcome.rollbackOutcome}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-lg font-semibold">Governance Heatmap</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Object.entries(snapshot.governanceHeatmap).map(([key, zones]) => (
                    <div key={key} className="rounded-xl border border-slate-800 p-4">
                      <p className="text-sm font-semibold capitalize text-slate-200">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        {zones.length === 0 ? (
                          <p className="text-slate-500">No hotspots detected.</p>
                        ) : (
                          zones.slice(0, 4).map((zone) => (
                            <div key={`${key}-${zone.zone}`} className="rounded-lg border border-slate-800 p-2">
                              <p className="font-medium">{zone.zone}</p>
                              <p className="text-xs text-slate-500">{zone.summary}</p>
                              <p className="mt-1 text-xs text-cyan-200">score {percent(zone.score)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-lg font-semibold">Recovery Intelligence Effectiveness</h2>
                <div className="mt-4 space-y-4">
                  {snapshot.recoveryIntelligenceEffectiveness.byUser.slice(0, 8).map((item) => (
                    <article key={item.userId} className="rounded-xl border border-slate-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-100">{item.userId}</p>
                          <p className="text-xs uppercase tracking-wide text-cyan-300">{item.tier}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm text-slate-300">
                        <div>
                          <p className="text-xs text-slate-500">Best strategies</p>
                          <p>{item.bestStrategies.join(", ") || "None recorded"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Failed strategies</p>
                          <p>{item.failedStrategies.join(", ") || "None recorded"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}
      </div>
    </main>
  )
}