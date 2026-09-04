import type { AdaptiveAutonomyStage } from "./adaptivePermissionBoundary.ts"

export type AutonomyExecutionAuthority = "shadow_only" | "assistive" | "autonomous"

export type AutonomyConfidenceInput = {
  decision: string
  actionStage: AdaptiveAutonomyStage
  rollbackProbability: number
  trustDisruptionProbability: number
  interruptionCost: number
  adaptiveComfort: number
  interventionAcceptanceScore: number
  recoveryResponsiveness: number
  historicalSuccessSimilarity?: number
}

export type AutonomyConfidenceScore = {
  decisionConfidence: number
  reversibility: number
  expectedTrustImpact: number
  interruptionCost: number
  historicalSuccessSimilarity: number
  authorityLevel: AutonomyExecutionAuthority
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function reversibilityForDecision(decision: string, actionStage: AdaptiveAutonomyStage): number {
  if (decision === "awaiting_user_action" || decision === "manual_review_required") {
    return 1
  }
  if (actionStage === "recommendations_only") {
    return 0.95
  }
  if (actionStage === "passive_adaptation") {
    return 0.78
  }
  if (actionStage === "autonomous_pacing") {
    return 0.56
  }
  return 0.28
}

export function scoreAutonomyConfidence(input: AutonomyConfidenceInput): AutonomyConfidenceScore {
  const reversibility = reversibilityForDecision(input.decision, input.actionStage)
  const historicalSuccessSimilarity = clamp01(
    input.historicalSuccessSimilarity ??
      input.interventionAcceptanceScore * 0.55 + input.recoveryResponsiveness * 0.45,
  )
  const expectedTrustImpact = clamp01(1 - input.trustDisruptionProbability)

  const decisionConfidence = clamp01(
    expectedTrustImpact * 0.26 +
      reversibility * 0.2 +
      (1 - input.rollbackProbability) * 0.18 +
      (1 - input.interruptionCost) * 0.14 +
      input.adaptiveComfort * 0.1 +
      input.interventionAcceptanceScore * 0.06 +
      historicalSuccessSimilarity * 0.06,
  )

  const authorityLevel: AutonomyExecutionAuthority =
    decisionConfidence < 0.45
      ? "shadow_only"
      : decisionConfidence < 0.72
        ? "assistive"
        : "autonomous"

  return {
    decisionConfidence,
    reversibility,
    expectedTrustImpact,
    interruptionCost: clamp01(input.interruptionCost),
    historicalSuccessSimilarity,
    authorityLevel,
  }
}
