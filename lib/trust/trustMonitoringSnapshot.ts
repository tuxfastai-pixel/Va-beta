import {
  listTrustHistoryRecords,
  summarizeTrustHistory,
  type TrustHistoryRecord,
} from "./trustHistoryStore.ts"
import type { TrustMonitoringSnapshot } from "./trustMonitoringShared.ts"

export async function buildTrustMonitoringSnapshot(limit = 120): Promise<TrustMonitoringSnapshot> {
  const records = await listTrustHistoryRecords(limit)
  const summaries = records.map((record) => {
    const trustTrendSeries = record.trustWindows
      .slice(-24)
      .map((window) => Math.max(0, Math.min(1, window.metrics.compositeTrustScore)))

    return {
      ...summarizeTrustHistory(record),
      transitions: record.transitions.slice(-5).reverse(),
      trustTrendSeries,
    }
  })

  const allAlerts = summaries.flatMap((summary) => summary.driftAlerts)
  const highSeverityAlerts = allAlerts.filter((alert) => alert.severity === "high").length
  const averageTrustMomentum =
    summaries.length > 0
      ? summaries.reduce((sum, summary) => sum + summary.trustMomentum, 0) / summaries.length
      : 0

  const maxTrendLength = summaries.reduce((max, summary) => Math.max(max, summary.trustTrendSeries.length), 0)
  const aggregateTrendSeries = Array.from({ length: maxTrendLength }).map((_, index) => {
    const valuesAtIndex = summaries
      .map((summary) => {
        const offset = summary.trustTrendSeries.length - maxTrendLength + index
        return offset >= 0 ? summary.trustTrendSeries[offset] : null
      })
      .filter((value): value is number => typeof value === "number")

    if (valuesAtIndex.length === 0) {
      return 0
    }

    return valuesAtIndex.reduce((sum, value) => sum + value, 0) / valuesAtIndex.length
  })

  return {
    generatedAt: new Date().toISOString(),
    summaries,
    aggregateTrendSeries,
    totals: {
      usersTracked: summaries.length,
      activeDriftAlerts: allAlerts.length,
      highSeverityAlerts,
      averageTrustMomentum,
    },
  }
}
