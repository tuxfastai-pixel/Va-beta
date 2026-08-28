"use client"

import { useEffect, useState } from "react"

type ReplayEntry = {
  timestamp: number
  equilibriumState: string
  workspaceDensity: "light" | "focused" | "expanded"
  notificationCadence: "quiet" | "steady" | "fast"
  pacingMode: "reduced" | "normal" | "adaptive"
  trustScore: number
  recoveryActivated: boolean
  continuityConfidence: number
  emotionalState: "calm" | "strained" | "recovering" | "overloaded"
}

type ReplayReport = {
  userId: string
  regime: string
  replay: {
    userId: string
    timeline: ReplayEntry[]
    behavioralTimeline: string[]
    governanceDecisionTrail: string[]
    counterfactualAnalysis: string[]
    validation: {
      pacingStayedCalm: boolean
      notificationsDownshifted: boolean
      trustNotDegraded: boolean
      workspaceAdapted: boolean
      recoveryActivatedOnOverload: boolean
    }
  }
  shadowDecisions: Array<{
    id: string
    timestamp: number
    decision: string
    confidence: number
    expectedBenefit: {
      expectedFatigueReduction: number
      expectedTrustStabilityGain: number
    }
    actualOutcome?: {
      fatigueActuallyRose: boolean
      trustActuallyDropped: boolean
    }
  }>
}

type ReplayResponse = {
  generatedAt: string
  windowHours: number
  filters: {
    userId: string | null
    regime: string | null
  }
  reports: ReplayReport[]
  status: string
}

function boolBadge(value: boolean): string {
  return value ? "YES" : "NO"
}

function pct(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function buildQuery(params: { userId: string; hours: string; regime: string }): string {
  const search = new URLSearchParams()
  if (params.userId.trim()) {
    search.set("userId", params.userId.trim())
  }
  if (params.hours.trim()) {
    search.set("hours", params.hours.trim())
  }
  if (params.regime.trim()) {
    search.set("regime", params.regime.trim())
  }
  const query = search.toString()
  return query ? `/api/admin/replay-validation?${query}` : "/api/admin/replay-validation"
}

export default function ReplayValidationPage() {
  const [data, setData] = useState<ReplayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState("")
  const [hours, setHours] = useState("24")
  const [regime, setRegime] = useState("")

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const response = await fetch(buildQuery({ userId, hours, regime }))
        if (!response.ok) {
          throw new Error("Failed to load replay validation")
        }

        const payload = (await response.json()) as ReplayResponse
        if (!mounted) {
          return
        }

        setData(payload)
        setError(null)
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Unknown replay validation error")
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
    }, 30_000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [userId, hours, regime])

  async function refreshNow() {
    setLoading(true)
    try {
      const response = await fetch(buildQuery({ userId, hours, regime }))
      if (!response.ok) {
        throw new Error("Failed to load replay validation")
      }

      const payload = (await response.json()) as ReplayResponse
      setData(payload)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown replay validation error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <main className="p-8">Loading replay validation...</main>
  }

  if (error || !data) {
    return <main className="p-8 text-red-500">Replay validation unavailable: {error ?? "No data"}</main>
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Phase 14 Runtime Validation</p>
          <h1 className="mt-3 text-3xl font-semibold">Replay And Shadow Calibration</h1>
          <p className="mt-2 text-sm text-slate-300">
            Reconstructs minute-by-minute adaptive behavior and compares shadow-mode intent with observed outcomes.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Last update: {new Date(data.generatedAt).toLocaleString()} • Window: {data.windowHours}h
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="User ID filter"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <input
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              placeholder="Hours"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <select
              value={regime}
              onChange={(event) => setRegime(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="">All regimes</option>
              <option value="guarded">Guarded</option>
              <option value="balanced">Balanced</option>
              <option value="progressive">Progressive</option>
            </select>
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
          <p className="mt-2 text-xs text-slate-400">
            Active filters: userId={data.filters.userId ?? "all"} • regime={data.filters.regime ?? "all"}
          </p>
        </header>

        {data.reports.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            No replay data found in the selected time window.
          </section>
        ) : (
          <section className="space-y-5">
            {data.reports.map((report) => (
              <article key={report.userId} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-xl font-semibold">{report.userId}</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-300">Trust regime: {report.regime}</p>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Calm pacing</p>
                    <p className="mt-1 font-semibold">{boolBadge(report.replay.validation.pacingStayedCalm)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Notification downshift</p>
                    <p className="mt-1 font-semibold">{boolBadge(report.replay.validation.notificationsDownshifted)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Trust preserved</p>
                    <p className="mt-1 font-semibold">{boolBadge(report.replay.validation.trustNotDegraded)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Workspace adapted</p>
                    <p className="mt-1 font-semibold">{boolBadge(report.replay.validation.workspaceAdapted)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Recovery on overload</p>
                    <p className="mt-1 font-semibold">{boolBadge(report.replay.validation.recoveryActivatedOnOverload)}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-slate-800 p-4">
                    <h3 className="text-sm font-semibold">Behavioral Timeline</h3>
                    <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-sm text-slate-200">
                      {report.replay.behavioralTimeline.slice(-60).map((entry, idx) => (
                        <li key={`${report.userId}-behavior-${idx}`} className="rounded border border-slate-800 px-2 py-1">
                          {entry}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-xl border border-slate-800 p-4">
                    <h3 className="text-sm font-semibold">Governance Decision Trail</h3>
                    <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-sm text-slate-200">
                      {report.replay.governanceDecisionTrail.slice(-60).map((entry, idx) => (
                        <li key={`${report.userId}-decision-${idx}`} className="rounded border border-slate-800 px-2 py-1">
                          {entry}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section className="mt-4 rounded-xl border border-slate-800 p-4">
                  <h3 className="text-sm font-semibold">Counterfactual Analysis</h3>
                  {report.replay.counterfactualAnalysis.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No counterfactual alerts in this window.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-amber-200">
                      {report.replay.counterfactualAnalysis.map((item, idx) => (
                        <li key={`${report.userId}-counterfactual-${idx}`} className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="mt-4 rounded-xl border border-slate-800 p-4">
                  <h3 className="text-sm font-semibold">Shadow Mode Decisions</h3>
                  {report.shadowDecisions.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No shadow decisions captured for this user.</p>
                  ) : (
                    <ul className="mt-3 max-h-72 space-y-2 overflow-auto text-sm text-slate-200">
                      {report.shadowDecisions.map((entry) => (
                        <li key={entry.id} className="rounded border border-slate-800 px-3 py-2">
                          <p className="font-semibold">{new Date(entry.timestamp).toLocaleString()}</p>
                          <p className="mt-1">{entry.decision}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            confidence={pct(entry.confidence)} • expected fatigue reduction={pct(entry.expectedBenefit.expectedFatigueReduction)} • expected trust stabilization={pct(entry.expectedBenefit.expectedTrustStabilityGain)}
                          </p>
                          {entry.actualOutcome && (
                            <p className="mt-1 text-xs text-slate-400">
                              observed: fatigue rose={String(entry.actualOutcome.fatigueActuallyRose)} • trust dropped={String(entry.actualOutcome.trustActuallyDropped)}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
