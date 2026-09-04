export type TrustDriftAlertSeverity = "low" | "medium" | "high"

export type TrustSummary = {
  userId: string
  trustRegime: string
  trustMomentum: number
  updatedAt: number
  transitionCount: number
  pacingAcceptance: number
  interventionSupportiveness: number
  autonomyComfort: number
  recoverySuccess: number
  latestMetrics?: {
    continuityTrustScore: number
    perceivedReliability: number
  }
  transitions: Array<{
    timestamp: number
    previousRegime: string
    nextRegime: string
    reason: string
  }>
  driftAlerts: Array<{
    id: string
    timestamp: number
    kind: string
    severity: TrustDriftAlertSeverity
    description: string
    evidence: Record<string, number | string>
  }>
  trustTrendSeries: number[]
}

export type TrustMonitoringSnapshot = {
  generatedAt: string
  summaries: TrustSummary[]
  aggregateTrendSeries: number[]
  totals: {
    usersTracked: number
    activeDriftAlerts: number
    highSeverityAlerts: number
    averageTrustMomentum: number
  }
}

export function driftSeverityColor(severity: TrustDriftAlertSeverity): string {
  if (severity === "high") {
    return "border-red-500/50 bg-red-950/30 text-red-100"
  }
  if (severity === "medium") {
    return "border-amber-500/50 bg-amber-950/30 text-amber-100"
  }
  return "border-slate-700 bg-slate-900/40 text-slate-200"
}

export function regimeTone(regime: string): string {
  if (regime === "guarded") {
    return "text-red-300"
  }
  if (regime === "progressive") {
    return "text-emerald-300"
  }
  return "text-cyan-300"
}

export function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}