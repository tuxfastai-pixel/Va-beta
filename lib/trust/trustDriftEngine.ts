import {
  appendTrustDriftAlerts,
  loadTrustHistoryRecord,
  type TrustDriftAlert,
  type TrustHistoryRecord,
} from "./trustHistoryStore.ts"

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0
  }

  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function severityFromMagnitude(magnitude: number): "low" | "medium" | "high" {
  if (magnitude >= 0.35) {
    return "high"
  }
  if (magnitude >= 0.2) {
    return "medium"
  }
  return "low"
}

function alertId(userId: string, kind: TrustDriftAlert["kind"], timestamp: number): string {
  return `${userId}:${kind}:${Math.floor(timestamp / 60_000)}`
}

export function detectTrustDrift(record: TrustHistoryRecord, now = Date.now()): TrustDriftAlert[] {
  const windows = record.trustWindows.slice(-24)
  const alerts: TrustDriftAlert[] = []

  if (windows.length >= 6) {
    const earlier = windows.slice(0, Math.max(1, Math.floor(windows.length / 2)))
    const latest = windows.slice(Math.max(1, Math.floor(windows.length / 2)))
    const earlierAvg = average(earlier.map((window) => window.metrics.compositeTrustScore))
    const latestAvg = average(latest.map((window) => window.metrics.compositeTrustScore))
    const drop = Math.max(0, earlierAvg - latestAvg)

    if (drop > 0.12) {
      alerts.push({
        id: alertId(record.userId, "gradual_trust_erosion", now),
        timestamp: now,
        kind: "gradual_trust_erosion",
        severity: severityFromMagnitude(drop),
        description: "Trust has trended downward across recent windows.",
        evidence: {
          earlierAverage: Number(earlierAvg.toFixed(3)),
          latestAverage: Number(latestAvg.toFixed(3)),
          drop: Number(drop.toFixed(3)),
        },
      })
    }

    const series = windows.map((window) => window.metrics.compositeTrustScore)
    const volatility = stdDev(series)
    const directionChanges = series.slice(1).reduce((count, value, index) => {
      const prev = series[index]
      const prevDelta = index > 0 ? prev - series[index - 1] : 0
      const nextDelta = value - prev
      return prevDelta * nextDelta < -0.015 ? count + 1 : count
    }, 0)

    if (volatility > 0.14 && directionChanges >= 3) {
      alerts.push({
        id: alertId(record.userId, "oscillating_confidence", now),
        timestamp: now,
        kind: "oscillating_confidence",
        severity: severityFromMagnitude(volatility + directionChanges * 0.03),
        description: "Trust confidence is oscillating and may destabilize user perception.",
        evidence: {
          volatility: Number(volatility.toFixed(3)),
          directionChanges,
        },
      })
    }
  }

  const recentRecovery = record.recoveryOutcomes.slice(-12)
  if (recentRecovery.length >= 4) {
    const failureRate =
      recentRecovery.filter((item) => !item.successful).length / Math.max(1, recentRecovery.length)
    const confidence = average(recentRecovery.map((item) => item.userConfidence))

    if (failureRate > 0.45 || confidence < 0.45) {
      alerts.push({
        id: alertId(record.userId, "recovery_distrust", now),
        timestamp: now,
        kind: "recovery_distrust",
        severity: severityFromMagnitude(Math.max(failureRate, 1 - confidence)),
        description: "Recovery outcomes indicate possible distrust in stabilization behavior.",
        evidence: {
          failureRate: Number(failureRate.toFixed(3)),
          confidence: Number(confidence.toFixed(3)),
        },
      })
    }
  }

  const recentInterventions = record.interventionEffects.slice(-16)
  if (recentInterventions.length >= 5) {
    const rejectionRate =
      recentInterventions.filter((effect) => !effect.accepted).length /
      Math.max(1, recentInterventions.length)
    const support = average(recentInterventions.map((effect) => effect.perceivedSupport))

    if (rejectionRate > 0.35 || support < 0.48) {
      alerts.push({
        id: alertId(record.userId, "intervention_rejection", now),
        timestamp: now,
        kind: "intervention_rejection",
        severity: severityFromMagnitude(Math.max(rejectionRate, 1 - support)),
        description: "Interventions are increasingly perceived as unhelpful or rejected.",
        evidence: {
          rejectionRate: Number(rejectionRate.toFixed(3)),
          support: Number(support.toFixed(3)),
        },
      })
    }
  }

  const recentAutonomy = record.autonomyAcceptance.slice(-16)
  if (recentAutonomy.length >= 6) {
    const overrideRate =
      recentAutonomy.filter((item) => item.requiredOverride).length /
      Math.max(1, recentAutonomy.length)
    const comfort = average(recentAutonomy.map((item) => item.comfort))

    if (overrideRate > 0.35 || comfort < 0.5) {
      alerts.push({
        id: alertId(record.userId, "autonomy_discomfort_spike", now),
        timestamp: now,
        kind: "autonomy_discomfort_spike",
        severity: severityFromMagnitude(Math.max(overrideRate, 1 - comfort)),
        description: "Autonomy comfort has dropped and user overrides are increasing.",
        evidence: {
          overrideRate: Number(overrideRate.toFixed(3)),
          comfort: Number(comfort.toFixed(3)),
        },
      })
    }
  }

  return alerts
}

export async function evaluateTrustDriftForUser(userId: string, now = Date.now()) {
  const record = await loadTrustHistoryRecord(userId)
  const alerts = detectTrustDrift(record, now)

  if (alerts.length > 0) {
    await appendTrustDriftAlerts(userId, alerts, {
      mutationKey: `trust-drift:${userId}:${Math.floor(now / 60_000)}`,
    })
  }

  return alerts
}
