export type MonitoringTimePoint = {
  timestamp: string
  overloadPreventionRate: number
  suppressionRate: number
  fatigueForecast: number
  workspaceContractionRate: number
  transitionsPerHour: number
}

export type EquilibriumAnomaly = {
  kind: "oscillation" | "runaway_interaction" | "overload_escalation" | "suppression_collapse"
  severity: "low" | "medium" | "high"
  description: string
}

export type EquilibriumMonitoringSnapshot = {
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
  anomalies: EquilibriumAnomaly[]
  timeline: MonitoringTimePoint[]
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

function seededNumber(seed: number, min: number, max: number): number {
  const x = Math.abs(Math.sin(seed * 12.9898 + 78.233)) % 1
  return min + x * (max - min)
}

function detectAnomalies(snapshot: Omit<EquilibriumMonitoringSnapshot, "anomalies">): EquilibriumAnomaly[] {
  const anomalies: EquilibriumAnomaly[] = []

  if (snapshot.forecasts.projectedOscillationRisk24h > 0.62 || snapshot.counters.equilibriumTransitions > 72) {
    anomalies.push({
      kind: "oscillation",
      severity: snapshot.forecasts.projectedOscillationRisk24h > 0.78 ? "high" : "medium",
      description: "Frequent state transitions indicate possible equilibrium oscillation.",
    })
  }

  if (snapshot.forecasts.projectedRunawayInteractionRisk24h > 0.58 || snapshot.counters.cadenceShifts > 80) {
    anomalies.push({
      kind: "runaway_interaction",
      severity: snapshot.forecasts.projectedRunawayInteractionRisk24h > 0.78 ? "high" : "medium",
      description: "Interaction cadence changes are accelerating faster than expected.",
    })
  }

  if (snapshot.forecasts.projectedFatigue24h > 0.68 && snapshot.rates.adaptiveDownshiftAccuracy < 0.7) {
    anomalies.push({
      kind: "overload_escalation",
      severity: "high",
      description: "Predicted fatigue is high while downshift effectiveness appears weak.",
    })
  }

  if (snapshot.rates.suppressionRate < 0.25 && snapshot.rates.sessionAbandonmentRate > 0.32) {
    anomalies.push({
      kind: "suppression_collapse",
      severity: "medium",
      description: "Suppression may be too permissive relative to abandonment pressure.",
    })
  }

  return anomalies
}

export function buildMonitoringSnapshot(now: Date = new Date()): EquilibriumMonitoringSnapshot {
  const seed = Math.floor(now.getTime() / (1000 * 60 * 15))

  const counters = {
    overloadPreventions: Math.round(seededNumber(seed + 1, 40, 130)),
    cadenceShifts: Math.round(seededNumber(seed + 2, 20, 95)),
    recoveryActivations: Math.round(seededNumber(seed + 3, 8, 42)),
    suppressedNotifications: Math.round(seededNumber(seed + 4, 120, 620)),
    equilibriumTransitions: Math.round(seededNumber(seed + 5, 18, 90)),
    notificationDownshifts: Math.round(seededNumber(seed + 6, 16, 75)),
    workspaceModeTransitions: Math.round(seededNumber(seed + 7, 12, 70)),
  }

  const rates = {
    suppressionRate: clamp01(seededNumber(seed + 8, 0.34, 0.82)),
    recoveryActivationRate: clamp01(seededNumber(seed + 9, 0.08, 0.38)),
    workspaceContractionFrequency: clamp01(seededNumber(seed + 10, 0.1, 0.46)),
    sessionAbandonmentRate: clamp01(seededNumber(seed + 11, 0.05, 0.34)),
    continuityScoreTrend: seededNumber(seed + 12, -0.08, 0.19),
    adaptiveDownshiftAccuracy: clamp01(seededNumber(seed + 13, 0.64, 0.94)),
    fatiguePredictionAccuracy: clamp01(seededNumber(seed + 14, 0.61, 0.92)),
  }

  const forecasts = {
    projectedFatigue24h: clamp01(seededNumber(seed + 15, 0.32, 0.82)),
    projectedOscillationRisk24h: clamp01(seededNumber(seed + 16, 0.18, 0.8)),
    projectedRunawayInteractionRisk24h: clamp01(seededNumber(seed + 17, 0.15, 0.78)),
  }

  const timeline: MonitoringTimePoint[] = Array.from({ length: 12 }).map((_, idx) => {
    const pointSeed = seed - (11 - idx)
    const ts = new Date(now.getTime() - (11 - idx) * 2 * 60 * 60 * 1000)
    return {
      timestamp: ts.toISOString(),
      overloadPreventionRate: clamp01(seededNumber(pointSeed + 1, 0.45, 0.92)),
      suppressionRate: clamp01(seededNumber(pointSeed + 2, 0.31, 0.84)),
      fatigueForecast: clamp01(seededNumber(pointSeed + 3, 0.24, 0.81)),
      workspaceContractionRate: clamp01(seededNumber(pointSeed + 4, 0.09, 0.51)),
      transitionsPerHour: seededNumber(pointSeed + 5, 0.6, 4.2),
    }
  })

  const base: Omit<EquilibriumMonitoringSnapshot, "anomalies"> = {
    generatedAt: now.toISOString(),
    counters,
    rates,
    forecasts,
    timeline,
  }

  return {
    ...base,
    anomalies: detectAnomalies(base),
  }
}
