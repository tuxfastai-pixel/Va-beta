import type { EquilibriumEvent } from "@/lib/telemetry/equilibriumEventStream"

export type EquilibriumAnomaly = {
  kind: "oscillation" | "runaway_interaction" | "overload_escalation" | "suppression_collapse"
  severity: "low" | "medium" | "high"
  description: string
}

export type EquilibriumAggregation = {
  generatedAt: number
  totals: {
    eventCount: number
    uniqueUsers: number
    transitions: number
    suppressions: number
    cadenceDownshifts: number
    workspaceContractions: number
    recoveryActivations: number
    fatiguePredictions: number
    continuitySafeguards: number
    orchestrationOverrides: number
  }
  metrics: {
    recoverySuccessRate: number
    suppressionAccuracy: number
    workspaceContractionFrequency: number
    sessionContinuityRetention: number
    downshiftTimingAccuracy: number
    fatigueForecastPrecision: number
    continuityReinforcementEngagement: number
  }
  transitions: {
    byPair: Record<string, number>
    frequencyPerHour: number
  }
  trend: {
    fatigueRiskAvg: number
    pressureLevelAvg: number
    fatigueTrend: number
    pressureTrend: number
  }
  anomalies: EquilibriumAnomaly[]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function trend(values: number[]): number {
  if (values.length < 2) {
    return 0
  }
  const half = Math.max(1, Math.floor(values.length / 2))
  const first = average(values.slice(0, half))
  const second = average(values.slice(values.length - half))
  return second - first
}

function countByType(events: EquilibriumEvent[], type: string): number {
  return events.filter((event) => event.eventType === type).length
}

function detectAnomalies(aggregation: Omit<EquilibriumAggregation, "anomalies">): EquilibriumAnomaly[] {
  const anomalies: EquilibriumAnomaly[] = []

  if (aggregation.transitions.frequencyPerHour > 6) {
    anomalies.push({
      kind: "oscillation",
      severity: aggregation.transitions.frequencyPerHour > 10 ? "high" : "medium",
      description: "Transition frequency suggests equilibrium oscillation.",
    })
  }

  if (aggregation.metrics.downshiftTimingAccuracy < 0.45) {
    anomalies.push({
      kind: "runaway_interaction",
      severity: "medium",
      description: "Cadence downshifts may be lagging behind rising pressure.",
    })
  }

  if (aggregation.trend.fatigueRiskAvg > 0.72 && aggregation.metrics.suppressionAccuracy < 0.55) {
    anomalies.push({
      kind: "overload_escalation",
      severity: "high",
      description: "Fatigue remains high while suppression quality is weak.",
    })
  }

  if (aggregation.metrics.suppressionAccuracy < 0.35 && aggregation.metrics.sessionContinuityRetention < 0.4) {
    anomalies.push({
      kind: "suppression_collapse",
      severity: "medium",
      description: "Suppression and continuity retention are simultaneously degraded.",
    })
  }

  return anomalies
}

export function aggregateEquilibriumEvents(
  events: EquilibriumEvent[],
  now = Date.now(),
): EquilibriumAggregation {
  const sorted = events.slice().sort((a, b) => a.timestamp - b.timestamp)
  const transitionEvents = sorted.filter((event) => event.eventType === "equilibrium_transition")
  const suppressions = countByType(sorted, "notification_suppression")
  const cadenceDownshifts = countByType(sorted, "cadence_downshift")
  const workspaceContractions = countByType(sorted, "workspace_contraction")
  const recoveryActivations = countByType(sorted, "recovery_activation")
  const fatiguePredictions = countByType(sorted, "fatigue_prediction")
  const continuitySafeguards = countByType(sorted, "continuity_safeguard")
  const orchestrationOverrides = countByType(sorted, "orchestration_override")

  const uniqueUsers = new Set(sorted.map((event) => event.userId)).size
  const byPair: Record<string, number> = {}
  for (const event of transitionEvents) {
    const key = `${event.previousState}->${event.nextState}`
    byPair[key] = (byPair[key] || 0) + 1
  }

  const firstTimestamp = sorted[0]?.timestamp ?? now
  const lastTimestamp = sorted[sorted.length - 1]?.timestamp ?? now
  const windowHours = Math.max(1 / 60, (lastTimestamp - firstTimestamp) / (1000 * 60 * 60))
  const frequencyPerHour = transitionEvents.length / windowHours

  const fatigueSeries = sorted.map((event) => event.fatigueRisk)
  const pressureSeries = sorted.map((event) => event.pressureLevel)

  const base: Omit<EquilibriumAggregation, "anomalies"> = {
    generatedAt: now,
    totals: {
      eventCount: sorted.length,
      uniqueUsers,
      transitions: transitionEvents.length,
      suppressions,
      cadenceDownshifts,
      workspaceContractions,
      recoveryActivations,
      fatiguePredictions,
      continuitySafeguards,
      orchestrationOverrides,
    },
    metrics: {
      recoverySuccessRate: clamp01(recoveryActivations / Math.max(1, recoveryActivations + countByType(sorted, "recovery_failed"))),
      suppressionAccuracy: clamp01(suppressions / Math.max(1, fatiguePredictions + suppressions)),
      workspaceContractionFrequency: clamp01(workspaceContractions / Math.max(1, sorted.length)),
      sessionContinuityRetention: clamp01(continuitySafeguards / Math.max(1, transitionEvents.length + continuitySafeguards)),
      downshiftTimingAccuracy: clamp01(cadenceDownshifts / Math.max(1, fatiguePredictions)),
      fatigueForecastPrecision: clamp01(1 - Math.abs(average(fatigueSeries) - average(pressureSeries))),
      continuityReinforcementEngagement: clamp01(
        sorted.filter((event) => event.eventType === "continuity_safeguard" && event.metadata?.engaged === true).length /
          Math.max(1, continuitySafeguards),
      ),
    },
    transitions: {
      byPair,
      frequencyPerHour,
    },
    trend: {
      fatigueRiskAvg: average(fatigueSeries),
      pressureLevelAvg: average(pressureSeries),
      fatigueTrend: trend(fatigueSeries),
      pressureTrend: trend(pressureSeries),
    },
  }

  return {
    ...base,
    anomalies: detectAnomalies(base),
  }
}
