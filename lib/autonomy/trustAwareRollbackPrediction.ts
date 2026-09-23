import type { AdaptiveAutonomyStage } from "./adaptivePermissionBoundary.ts"
import type { AutonomyProfile } from "./autonomyProfile.ts"

export type TrustAwareRollbackPredictionInput = {
  action: string
  actionStage: AdaptiveAutonomyStage
  trustMomentum: number
  trustRegime: "guarded" | "balanced" | "progressive"
  driftAlerts: Array<{ severity: "low" | "medium" | "high" }>
  profile: AutonomyProfile
}

export type TrustAwareRollbackPrediction = {
  rollbackProbability: number
  trustDisruptionProbability: number
  interruptionCost: number
  shouldThrottle: boolean
  recommendedAction: string
  reasons: string[]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function stageIntensity(stage: AdaptiveAutonomyStage): number {
  if (stage === "recommendations_only") {
    return 0.15
  }
  if (stage === "passive_adaptation") {
    return 0.4
  }
  if (stage === "autonomous_pacing") {
    return 0.65
  }
  return 0.9
}

function driftSeverityScore(input: TrustAwareRollbackPredictionInput): number {
  if (input.driftAlerts.length <= 0) {
    return 0
  }

  const score = input.driftAlerts.reduce((sum, alert) => {
    if (alert.severity === "high") {
      return sum + 1
    }
    if (alert.severity === "medium") {
      return sum + 0.6
    }
    return sum + 0.3
  }, 0)

  return clamp01(score / Math.max(1, input.driftAlerts.length))
}

export function predictTrustAwareRollback(input: TrustAwareRollbackPredictionInput): TrustAwareRollbackPrediction {
  const reasons: string[] = []
  const intensity = stageIntensity(input.actionStage)
  const driftScore = driftSeverityScore(input)
  const trustDeclineRisk = clamp01(input.trustMomentum < 0 ? Math.abs(input.trustMomentum) * 3 : 0)

  const rollbackProbability = clamp01(
    intensity * 0.28 +
      input.profile.rollbackSensitivity * 0.24 +
      (1 - input.profile.interventionAcceptance) * 0.16 +
      trustDeclineRisk * 0.16 +
      driftScore * 0.16,
  )

  const trustDisruptionProbability = clamp01(
    intensity * 0.24 +
      (1 - input.profile.automationComfort) * 0.2 +
      (1 - input.profile.continuityStability) * 0.2 +
      trustDeclineRisk * 0.2 +
      driftScore * 0.16,
  )

  const interruptionCost = clamp01(
    intensity * 0.25 +
      (1 - input.profile.interruptionTolerance) * 0.25 +
      (1 - input.profile.pacingTolerance) * 0.2 +
      (1 - input.profile.recoveryResponsiveness) * 0.15 +
      driftScore * 0.15,
  )

  if (input.trustRegime === "guarded") {
    reasons.push("Guarded trust regime indicates elevated autonomy disruption risk")
  }
  if (input.trustMomentum < -0.08) {
    reasons.push("Trust momentum is declining and raises rollback likelihood")
  }
  if (input.profile.rollbackSensitivity > 0.65) {
    reasons.push("Rollback sensitivity is high for this user profile")
  }
  if (driftScore >= 0.55) {
    reasons.push("Recent drift alerts indicate trust instability")
  }

  const shouldThrottle = rollbackProbability >= 0.55 || trustDisruptionProbability >= 0.52 || interruptionCost >= 0.62
  const recommendedAction = shouldThrottle
    ? rollbackProbability >= 0.7 || trustDisruptionProbability >= 0.68
      ? "manual_review_required"
      : "awaiting_user_action"
    : input.action

  return {
    rollbackProbability,
    trustDisruptionProbability,
    interruptionCost,
    shouldThrottle,
    recommendedAction,
    reasons,
  }
}