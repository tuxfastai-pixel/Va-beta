"use client"

import { useEffect, useState } from "react"

type AuditItem = {
  userId: string
  tier: "conservative" | "balanced" | "progressive" | "highly_autonomous"
  trustRegime: "guarded" | "balanced" | "progressive"
  trustMomentum: number
  boundaryStage: "recommendations_only" | "passive_adaptation" | "autonomous_pacing" | "autonomous_workspace_restructuring"
  rollbackProbability: number
  trustDisruptionProbability: number
  interruptionCost: number
  invariantViolations: Array<{ id: string; message: string; severity: "high" | "medium" }>
  recommendedAction: string
  autonomy: {
    userId: string
    tier: string
    automationComfort: number
    pacingTolerance: number
    workspaceFlexibility: number
    interruptionTolerance: number
    adaptationAcceptance: number
    rollbackSensitivity: number
    continuityStability: number
    interventionAcceptance: number
    recoveryResponsiveness: number
    updatedAt: number
  }
  updatedAt: number
}

type AuditSnapshot = {
  generatedAt: string
  filters: { userId: string | null; tier: string | null }
  totals: {
    usersTracked: number
    conservative: number
    balanced: number
    progressive: number
    highlyAutonomous: number
    throttled: number
    invariantViolations: number
  }
  items: AuditItem[]
  status: string
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

export default function AutonomyAuditPage() {
  const [snapshot, setSnapshot] = useState<AuditSnapshot | null>(null)
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
          throw new Error("Failed to load autonomy audit snapshot")
        }

        const payload = (await response.json()) as { snapshot?: AuditSnapshot }
        if (mounted && payload.snapshot) {
          setSnapshot(payload.snapshot)
          setError(null)
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unknown autonomy audit error")
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
        throw new Error("Failed to load autonomy audit snapshot")
      }

      const payload = (await response.json()) as { snapshot?: AuditSnapshot }
      if (payload.snapshot) {
        setSnapshot(payload.snapshot)
        setError(null)
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unknown autonomy audit error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Autonomy Audit</p>
            <p className="rounded-full border border-cyan-500/40 bg-cyan-900/20 px-3 py-1 text-xs text-cyan-200">
              {loading ? "Refreshing" : "Live"}
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold">Trust-Calibrated Adaptive Autonomy</h1>
          <p className="mt-2 text-sm text-slate-300">
            Tracks autonomy tier, earned permission stage, rollback risk, and governance invariant status.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Last update: {snapshot ? new Date(snapshot.generatedAt).toLocaleString() : "Waiting for data"}
          </p>
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

          {snapshot && (
            <p className="mt-2 text-xs text-slate-400">
              Active filters: userId={snapshot.filters.userId ?? "all"} • tier={snapshot.filters.tier ?? "all"}
            </p>
          )}
        </header>

        {snapshot && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs text-slate-400">Users Tracked</p>
              <p className="mt-2 text-2xl font-bold">{snapshot.totals.usersTracked}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs text-slate-400">Throttled Users</p>
              <p className="mt-2 text-2xl font-bold text-amber-300">{snapshot.totals.throttled}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs text-slate-400">Invariant Violations</p>
              <p className="mt-2 text-2xl font-bold text-red-300">{snapshot.totals.invariantViolations}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
              <p className="text-xs text-slate-400">Tier Mix</p>
              <p className="mt-2">Conservative: {snapshot.totals.conservative}</p>
              <p>Balanced: {snapshot.totals.balanced}</p>
              <p>Progressive: {snapshot.totals.progressive}</p>
              <p>Highly autonomous: {snapshot.totals.highlyAutonomous}</p>
            </div>
          </section>
        )}

        {!snapshot ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            Loading autonomy audit snapshot...
          </section>
        ) : snapshot.items.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            No autonomy profiles match the current filters.
          </section>
        ) : (
          <section className="space-y-4">
            {snapshot.items.map((item) => (
              <article key={item.userId} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">User</p>
                    <h2 className="mt-1 text-xl font-semibold">{item.userId}</h2>
                    <p className="mt-2 text-sm uppercase tracking-wide text-cyan-300">Tier: {item.tier}</p>
                    <p className="text-sm text-slate-300">Boundary: {item.boundaryStage}</p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>Trust regime: {item.trustRegime}</p>
                    <p>Momentum: {item.trustMomentum.toFixed(3)}</p>
                    <p>Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Automation Comfort</p>
                    <p className="mt-1 font-semibold">{percent(item.autonomy.automationComfort)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Pacing Tolerance</p>
                    <p className="mt-1 font-semibold">{percent(item.autonomy.pacingTolerance)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Workspace Flexibility</p>
                    <p className="mt-1 font-semibold">{percent(item.autonomy.workspaceFlexibility)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Interruption Tolerance</p>
                    <p className="mt-1 font-semibold">{percent(item.autonomy.interruptionTolerance)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Adaptation Acceptance</p>
                    <p className="mt-1 font-semibold">{percent(item.autonomy.adaptationAcceptance)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Rollback Sensitivity</p>
                    <p className="mt-1 font-semibold">{percent(item.autonomy.rollbackSensitivity)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Recovery Responsiveness</p>
                    <p className="mt-1 font-semibold">{percent(item.autonomy.recoveryResponsiveness)}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-slate-800 p-4">
                    <h3 className="text-sm font-semibold text-slate-200">Rollback and Throttle</h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-slate-800 p-3">
                        <p className="text-xs text-slate-400">Rollback probability</p>
                        <p className="mt-1 font-semibold text-amber-300">{percent(item.rollbackProbability)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 p-3">
                        <p className="text-xs text-slate-400">Trust disruption</p>
                        <p className="mt-1 font-semibold text-amber-300">{percent(item.trustDisruptionProbability)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 p-3">
                        <p className="text-xs text-slate-400">Interruption cost</p>
                        <p className="mt-1 font-semibold text-amber-300">{percent(item.interruptionCost)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">Recommended action: {item.recommendedAction}</p>
                  </section>

                  <section className="rounded-xl border border-slate-800 p-4">
                    <h3 className="text-sm font-semibold text-slate-200">Governance Invariants</h3>
                    {item.invariantViolations.length === 0 ? (
                      <p className="mt-2 text-sm text-emerald-300">No invariant violations detected.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm text-slate-200">
                        {item.invariantViolations.map((violation) => (
                          <li key={violation.id} className="rounded border border-slate-800 p-2">
                            <p className="font-semibold uppercase tracking-wide text-red-300">{violation.id}</p>
                            <p className="text-slate-300">{violation.message}</p>
                            <p className="mt-1 text-xs text-slate-500">Severity: {violation.severity}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}