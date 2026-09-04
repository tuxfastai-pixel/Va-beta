"use client"

import { useEffect, useMemo, useState } from "react"

type EquilibriumMonitoringSnapshot = {
  generatedAt: string
  counters: {
    overloadPreventions: number
    cadenceShifts: number
    recoveryActivations: number
    suppressedNotifications: number
    equilibriumTransitions: number
    notificationDownshifts: number
    workspaceModeTransitions: number
  }
  rates: {
    suppressionRate: number
    recoveryActivationRate: number
    workspaceContractionFrequency: number
    sessionAbandonmentRate: number
    continuityScoreTrend: number
    adaptiveDownshiftAccuracy: number
    fatiguePredictionAccuracy: number
  }
  forecasts: {
    projectedFatigue24h: number
    projectedOscillationRisk24h: number
    projectedRunawayInteractionRisk24h: number
  }
  anomalies: Array<{
    kind: "oscillation" | "runaway_interaction" | "overload_escalation" | "suppression_collapse"
    severity: "low" | "medium" | "high"
    description: string
  }>
  timeline: Array<{
    timestamp: string
    overloadPreventionRate: number
    suppressionRate: number
    fatigueForecast: number
    workspaceContractionRate: number
    transitionsPerHour: number
  }>
}

type TelemetryAggregation = {
  totals: {
    eventCount: number
    transitions: number
    recoveryActivations: number
    suppressions: number
    workspaceContractions: number
  }
  metrics: {
    suppressionAccuracy: number
    workspaceContractionFrequency: number
    sessionContinuityRetention: number
    downshiftTimingAccuracy: number
    fatigueForecastPrecision: number
  }
  anomalies: Array<{
    kind: "oscillation" | "runaway_interaction" | "overload_escalation" | "suppression_collapse"
    severity: "low" | "medium" | "high"
    description: string
  }>
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export default function EquilibriumMonitoringPage() {
  const [snapshot, setSnapshot] = useState<EquilibriumMonitoringSnapshot | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryAggregation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSnapshot() {
      try {
        const response = await fetch("/api/admin/equilibrium-monitoring")
        if (!response.ok) {
          throw new Error("Failed to fetch monitoring snapshot")
        }
        const payload = (await response.json()) as {
          snapshot?: EquilibriumMonitoringSnapshot
          telemetry?: TelemetryAggregation
        }
        if (isMounted) {
          setSnapshot(payload.snapshot ?? null)
          setTelemetry(payload.telemetry ?? null)
          setError(null)
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Unknown monitoring error")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadSnapshot()
    const timer = setInterval(() => {
      void loadSnapshot()
    }, 60_000)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  const activeAnomalies = useMemo(
    () => telemetry?.anomalies ?? snapshot?.anomalies ?? [],
    [snapshot?.anomalies, telemetry?.anomalies],
  )
  const criticalAnomalies = useMemo(
    () => activeAnomalies.filter((anomaly) => anomaly.severity === "high"),
    [activeAnomalies],
  )

  if (loading) {
    return <div className="p-8">Loading equilibrium monitoring...</div>
  }

  if (error || !snapshot) {
    return <div className="p-8 text-red-500">Monitoring unavailable: {error ?? "No snapshot returned"}</div>
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Production Observability Layer</p>
          <h1 className="mt-3 text-3xl font-semibold">Equilibrium Monitoring</h1>
          <p className="mt-2 text-sm text-slate-300">
            Last snapshot: {new Date(snapshot.generatedAt).toLocaleString()}
          </p>
        </header>

        {criticalAnomalies.length > 0 && (
          <section className="rounded-2xl border border-red-500/40 bg-red-950/30 p-6">
            <h2 className="text-xl font-semibold text-red-300">High Severity Alerts</h2>
            <ul className="mt-3 space-y-2 text-sm text-red-100">
              {criticalAnomalies.map((anomaly) => (
                <li key={`${anomaly.kind}-${anomaly.description}`}>{anomaly.description}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Overload Preventions</p>
            <p className="mt-2 text-2xl font-bold">{telemetry?.totals.eventCount ?? snapshot.counters.overloadPreventions}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Recovery Activations</p>
            <p className="mt-2 text-2xl font-bold">{telemetry?.totals.recoveryActivations ?? snapshot.counters.recoveryActivations}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Suppressed Notifications</p>
            <p className="mt-2 text-2xl font-bold">{telemetry?.totals.suppressions ?? snapshot.counters.suppressedNotifications}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Workspace Mode Transitions</p>
            <p className="mt-2 text-2xl font-bold">{telemetry?.totals.workspaceContractions ?? snapshot.counters.workspaceModeTransitions}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Core Rates</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>Suppression rate: {percent(snapshot.rates.suppressionRate)}</p>
              {telemetry && <p>Suppression accuracy: {percent(telemetry.metrics.suppressionAccuracy)}</p>}
              <p>Recovery activation rate: {percent(snapshot.rates.recoveryActivationRate)}</p>
              <p>Workspace contraction frequency: {percent(snapshot.rates.workspaceContractionFrequency)}</p>
              {telemetry && <p>Telemetry contraction frequency: {percent(telemetry.metrics.workspaceContractionFrequency)}</p>}
              <p>Session abandonment rate: {percent(snapshot.rates.sessionAbandonmentRate)}</p>
              {telemetry && <p>Continuity retention: {percent(telemetry.metrics.sessionContinuityRetention)}</p>}
              <p>Continuity score trend: {snapshot.rates.continuityScoreTrend.toFixed(3)}</p>
              <p>Adaptive downshift accuracy: {percent(telemetry?.metrics.downshiftTimingAccuracy ?? snapshot.rates.adaptiveDownshiftAccuracy)}</p>
              <p>Fatigue prediction accuracy: {percent(telemetry?.metrics.fatigueForecastPrecision ?? snapshot.rates.fatiguePredictionAccuracy)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">24h Forecasts</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>Projected fatigue: {percent(snapshot.forecasts.projectedFatigue24h)}</p>
              <p>Projected oscillation risk: {percent(snapshot.forecasts.projectedOscillationRisk24h)}</p>
              <p>Projected runaway interaction risk: {percent(snapshot.forecasts.projectedRunawayInteractionRisk24h)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Anomaly Stream</h2>
          {activeAnomalies.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-300">No active anomalies detected.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {activeAnomalies.map((anomaly) => (
                <li key={`${anomaly.kind}-${anomaly.description}`} className="rounded-lg border border-slate-700 px-3 py-2">
                  <span className="font-semibold uppercase text-xs mr-2">{anomaly.severity}</span>
                  {anomaly.description}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
