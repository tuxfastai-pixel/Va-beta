import type { PersonalEquilibriumProfile } from "@/lib/personalization/equilibriumProfile"
import type { BehavioralRhythmLearning } from "@/lib/personalization/rhythmLearning"
import type { PersonalizedRecoveryProfile } from "@/lib/personalization/recoveryProfiles"
import type { AdaptiveTrustModel } from "@/lib/personalization/trustContinuity"

export type AdaptiveConfidenceScore = {
  learningConfidence: number
  rhythmStability: number
  recoveryReliability: number
  trustContinuity: number
  identityCoherence: number
  overallConfidence: number
  recommendation: string
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function computeAdaptiveConfidenceScore(context: {
  profile: PersonalEquilibriumProfile
  rhythm: BehavioralRhythmLearning
  recovery: PersonalizedRecoveryProfile
  trust: AdaptiveTrustModel
  eventCount: number
}): AdaptiveConfidenceScore {
  const learningConfidence = clamp01(
    context.profile.recoverySpeed.confidence * 0.4 +
      context.recovery.confidence * 0.3 +
      Math.min(1, context.eventCount / 500) * 0.3,
  )

  const rhythmStability = clamp01(
    (context.rhythm.hourlyProfile.filter((item) => item.accelerationScore > 0.5).length / 24) * 0.5 +
      context.recovery.confidence * 0.5,
  )

  const recoveryReliability = clamp01(
    context.recovery.confidence * 0.6 + context.trust.trustStability * 0.4,
  )

  const trustContinuity = clamp01(
    context.trust.continuityConfidence * 0.5 +
      (context.trust.trustMomentum >= 0 ? 1 : 0) * 0.5,
  )

  const identityCoherence = clamp01(
    1 - Math.abs(context.trust.trustMomentum) * 0.3 -
      (1 - context.trust.regulationAcceptance) * 0.2 -
      (1 - context.trust.adaptationComfort) * 0.2 +
      context.profile.recoverySpeed.confidence * 0.3,
  )

  const overallConfidence = clamp01(
    learningConfidence * 0.2 +
      rhythmStability * 0.2 +
      recoveryReliability * 0.2 +
      trustContinuity * 0.2 +
      identityCoherence * 0.2,
  )

  let recommendation = ""
  if (overallConfidence >= 0.8) {
    recommendation = "High confidence: System reliably adapts. Automation safe."
  } else if (overallConfidence >= 0.6) {
    recommendation = "Moderate confidence: Monitor for pattern changes. Selective automation."
  } else if (overallConfidence >= 0.4) {
    recommendation = "Low confidence: Manual oversight recommended. Limit automation."
  } else {
    recommendation = "Very low confidence: System learning incomplete. Recommend manual control."
  }

  return {
    learningConfidence,
    rhythmStability,
    recoveryReliability,
    trustContinuity,
    identityCoherence,
    overallConfidence,
    recommendation,
  }
}
