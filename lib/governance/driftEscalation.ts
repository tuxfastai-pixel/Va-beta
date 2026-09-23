import type { IdentityDriftAlert } from "@/lib/personalization/identityDriftAlerts"
import type { AdaptiveTrustModel } from "@/lib/personalization/trustContinuity"
import type { EquilibriumIdentity } from "@/lib/personalization/equilibriumIdentity"

export type DriftEscalationLevel = "normal" | "elevated" | "critical" | "emergency"

export type DriftEscalationAnalysis = {
  level: DriftEscalationLevel
  severity: number
  factors: string[]
  governanceSeverity: "low" | "moderate" | "high" | "critical"
  shouldTightenAdaptation: boolean
  recommendRollback: boolean
  recommendedActions: Array<{
    action: string
    rationale: string
    urgency: "low" | "medium" | "high"
  }>
  summary: string
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function analyzeRepeatedDrift(
  recentAlerts: IdentityDriftAlert[],
  windowDaysAgo = 7,
): { count: number; acceleration: number } {
  const cutoff = Date.now() - windowDaysAgo * 24 * 60 * 60 * 1000
  const recent = recentAlerts.filter((alert) => alert.timestamp > cutoff)

  if (recent.length === 0) {
    return { count: 0, acceleration: 0 }
  }

  const sorted = recent.slice().sort((a, b) => a.timestamp - b.timestamp)
  const intervals = []
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp)
  }

  const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0
  const acceleration = intervals.length > 1 ? (intervals[0] - intervals[intervals.length - 1]) / Math.max(1, avgInterval) : 0

  return {
    count: recent.length,
    acceleration: clamp01(Math.max(0, Math.min(1, acceleration))),
  }
}

export function analyzeDriftEscalation(context: {
  recentAlerts: IdentityDriftAlert[]
  identity: EquilibriumIdentity
  trust: AdaptiveTrustModel
  recoveryFrequencyPerDay: number
  continuityEvents: number
  averageAdaptationIntensity: number
}): DriftEscalationAnalysis {
  const factors: string[] = []
  let severityScore = 0

  const driftAnalysis = analyzeRepeatedDrift(context.recentAlerts)

  if (driftAnalysis.count >= 2) {
    factors.push(`Repeated high drift signals (${driftAnalysis.count} in 7 days)`)
    severityScore += driftAnalysis.count >= 4 ? 0.3 : 0.2
  }

  if (driftAnalysis.acceleration > 0.25) {
    factors.push("Rising instability acceleration")
    severityScore += driftAnalysis.acceleration > 0.5 ? 0.25 : 0.18
  }

  if (context.trust.trustMomentum < -0.15 || context.trust.trustStability < 0.45) {
    factors.push("Trust decay detected")
    severityScore += context.trust.trustMomentum < -0.3 ? 0.22 : 0.14
  }

  if (context.recoveryFrequencyPerDay > 1.2) {
    factors.push(`High recovery dependency (${context.recoveryFrequencyPerDay.toFixed(2)} per day)`)
    severityScore += context.recoveryFrequencyPerDay > 1.8 ? 0.24 : 0.16
  }

  if (context.trust.continuityConfidence < 0.4) {
    factors.push("Continuity integrity at risk")
    severityScore += 0.25
  }

  if (context.averageAdaptationIntensity > 0.75) {
    factors.push("Adaptation intensity excessive")
    severityScore += 0.15
  }

  severityScore = clamp01(severityScore)

  const level: DriftEscalationLevel =
    severityScore >= 0.8
      ? "emergency"
      : severityScore >= 0.6
        ? "critical"
        : severityScore >= 0.35
          ? "elevated"
          : "normal"

  const recommendedActions: DriftEscalationAnalysis["recommendedActions"] = []

  if (level === "emergency") {
    recommendedActions.push({
      action: "emergency_rollback",
      rationale: "System integrity at critical risk",
      urgency: "high",
    })
    recommendedActions.push({
      action: "freeze_personalization",
      rationale: "Stop learning to stabilize state",
      urgency: "high",
    })
  }

  if (level === "critical") {
    recommendedActions.push({
      action: "force_balanced_mode",
      rationale: "Stabilize pacing and workspace",
      urgency: "high",
    })
    recommendedActions.push({
      action: "reduce_adaptation_intensity",
      rationale: "Lower mutation power to prevent further drift",
      urgency: "medium",
    })
  }

  if (level === "elevated") {
    recommendedActions.push({
      action: "trigger_recovery_mode",
      rationale: "Initiate structured stabilization",
      urgency: "medium",
    })
    recommendedActions.push({
      action: "suppress_proactive_adaptation",
      rationale: "Reduce automatic orchestration changes",
      urgency: "medium",
    })
  }

  if (driftAnalysis.count >= 2 && driftAnalysis.acceleration > 0.3) {
    recommendedActions.push({
      action: "reset_rhythm_learning",
      rationale: "Clear unstable rhythm patterns",
      urgency: "medium",
    })
  }

  const summary =
    level === "emergency"
      ? "EMERGENCY: System integrity compromised. Immediate intervention required."
      : level === "critical"
        ? "CRITICAL: Multiple stability factors degrading. Urgent governance action needed."
        : level === "elevated"
          ? "ELEVATED: Identity drift patterns detected. Governance monitoring recommended."
          : "NORMAL: Adaptive system operating within expected parameters."

    const governanceSeverity: DriftEscalationAnalysis["governanceSeverity"] =
      level === "emergency"
        ? "critical"
        : level === "critical"
          ? "high"
          : level === "elevated"
            ? "moderate"
            : "low"

    const shouldTightenAdaptation =
      level === "critical" ||
      level === "emergency" ||
      context.averageAdaptationIntensity > 0.75 ||
      driftAnalysis.acceleration > 0.35

    const recommendRollback =
      level === "emergency" ||
      (level === "critical" && (context.trust.continuityConfidence < 0.45 || driftAnalysis.count >= 4))

  return {
    level,
      severity: severityScore,
    factors,
      governanceSeverity,
      shouldTightenAdaptation,
      recommendRollback,
    recommendedActions,
    summary,
  }
}
