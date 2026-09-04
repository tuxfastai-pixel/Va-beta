"use client"

import { useEffect, useMemo, useState } from "react"
import {
  driftSeverityColor,
  percent,
  regimeTone,
  type TrustMonitoringSnapshot,
} from "@/lib/trust/trustMonitoringShared"

type Props = {
  initialSnapshot: TrustMonitoringSnapshot
}

function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return ""
  }

  if (values.length === 1) {
    const y = (1 - Math.max(0, Math.min(1, values[0]))) * (height - 2) + 1
    return `M 0 ${y} L ${width} ${y}`
  }

  const xStep = width / Math.max(1, values.length - 1)
  return values
    .map((value, index) => {
      const x = index * xStep
      const y = (1 - Math.max(0, Math.min(1, value))) * (height - 2) + 1
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

function TrendSparkline({ values }: { values: number[] }) {
  const width = 180
  const height = 44
  const path = buildSparklinePath(values, width, height)

  if (values.length === 0 || !path) {
    return <p className="text-xs text-slate-500">No trend data yet</p>
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full max-w-[180px]">
      <rect x="0" y="0" width={width} height={height} rx="6" className="fill-slate-900/60 stroke-slate-800" />
      <path d={path} className="fill-none stroke-cyan-300" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function TrustMonitoringLiveClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<TrustMonitoringSnapshot>(initialSnapshot)
  const [streamState, setStreamState] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let mounted = true

    const connect = () => {
      if (!mounted) {
        return
      }

      setStreamState((current) => (current === "live" ? "live" : "reconnecting"))
      source = new EventSource("/api/admin/trust-monitoring/stream?intervalMs=15000&limit=120")

      source.addEventListener("snapshot", (event) => {
        if (!mounted) {
          return
        }

        try {
          const nextSnapshot = JSON.parse((event as MessageEvent).data) as TrustMonitoringSnapshot
          setSnapshot(nextSnapshot)
          setStreamState("live")
          setError(null)
        } catch {
          setError("Received malformed stream payload")
        }
      })

      source.addEventListener("error", () => {
        if (!mounted) {
          return
        }

        setStreamState("reconnecting")
        setError("Live stream disconnected, retrying...")
        source?.close()
        reconnectTimer = setTimeout(connect, 2_000)
      })
    }

    connect()

    return () => {
      mounted = false
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      source?.close()
      setStreamState("offline")
    }
  }, [])

  const summaries = snapshot.summaries

  const streamBadge = useMemo(() => {
    if (streamState === "live") {
      return "Live"
    }
    if (streamState === "reconnecting") {
      return "Reconnecting"
    }
    if (streamState === "offline") {
      return "Offline"
    }
    return "Connecting"
  }, [streamState])

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Operational Trust Observability</p>
            <p className="rounded-full border border-cyan-500/40 bg-cyan-900/20 px-3 py-1 text-xs text-cyan-200">
              Stream: {streamBadge}
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold">Trust Monitoring</h1>
          <p className="mt-2 text-sm text-slate-300">
            Tracks trust regime, momentum, pacing acceptance, intervention supportiveness, autonomy comfort,
            recovery success, and drift alerts with causal evidence.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Last update: {new Date(snapshot.generatedAt).toLocaleString()}
          </p>
          {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Users Tracked</p>
            <p className="mt-2 text-2xl font-bold">{snapshot.totals.usersTracked}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Active Drift Alerts</p>
            <p className="mt-2 text-2xl font-bold">{snapshot.totals.activeDriftAlerts}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">High Severity Alerts</p>
            <p className="mt-2 text-2xl font-bold text-red-300">{snapshot.totals.highSeverityAlerts}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Average Trust Momentum</p>
            <p className="mt-2 text-2xl font-bold">{snapshot.totals.averageTrustMomentum.toFixed(3)}</p>
            <TrendSparkline values={snapshot.aggregateTrendSeries} />
          </div>
        </section>

        {summaries.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
            Trust history has not been generated yet. The page will populate as orchestrator cycles append trust windows.
          </section>
        ) : (
          <section className="space-y-4">
            {summaries.map((summary) => (
              <article key={summary.userId} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">User</p>
                    <h2 className="mt-1 text-xl font-semibold">{summary.userId}</h2>
                    <p className={`mt-2 text-sm font-semibold uppercase ${regimeTone(summary.trustRegime)}`}>
                      Regime: {summary.trustRegime}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>Momentum: {summary.trustMomentum.toFixed(3)}</p>
                    <p>Updated: {new Date(summary.updatedAt).toLocaleString()}</p>
                    <p>Transitions: {summary.transitionCount}</p>
                    <div className="ml-auto mt-2 flex justify-end">
                      <TrendSparkline values={summary.trustTrendSeries} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Continuity Trust</p>
                    <p className="mt-1 font-semibold">{percent(summary.latestMetrics?.continuityTrustScore ?? 0)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Pacing Acceptance</p>
                    <p className="mt-1 font-semibold">{percent(summary.pacingAcceptance)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Intervention Support</p>
                    <p className="mt-1 font-semibold">{percent(summary.interventionSupportiveness)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Autonomy Comfort</p>
                    <p className="mt-1 font-semibold">{percent(summary.autonomyComfort)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Recovery Success</p>
                    <p className="mt-1 font-semibold">{percent(summary.recoverySuccess)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400">Reliability</p>
                    <p className="mt-1 font-semibold">{percent(summary.latestMetrics?.perceivedReliability ?? 0)}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-slate-800 p-4">
                    <h3 className="text-sm font-semibold text-slate-200">Why Trust Changed</h3>
                    {summary.transitions.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-400">No regime transitions yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm text-slate-200">
                        {summary.transitions.map((transition) => (
                          <li key={`${transition.timestamp}-${transition.reason}`} className="rounded border border-slate-800 p-2">
                            <p className="font-semibold">
                              {transition.previousRegime} to {transition.nextRegime}
                            </p>
                            <p className="text-slate-300">{transition.reason}</p>
                            <p className="mt-1 text-xs text-slate-500">{new Date(transition.timestamp).toLocaleString()}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="rounded-xl border border-slate-800 p-4">
                    <h3 className="text-sm font-semibold text-slate-200">Trust Drift Alerts</h3>
                    {summary.driftAlerts.length === 0 ? (
                      <p className="mt-2 text-sm text-emerald-300">No recent trust drift alerts.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm">
                        {summary.driftAlerts.map((alert) => (
                          <li key={alert.id} className={`rounded border p-2 ${driftSeverityColor(alert.severity)}`}>
                            <p className="text-xs font-semibold uppercase tracking-wide">{alert.kind.replaceAll("_", " ")}</p>
                            <p className="mt-1">{alert.description}</p>
                            <p className="mt-1 text-xs opacity-80">Evidence: {JSON.stringify(alert.evidence)}</p>
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
