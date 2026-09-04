export type TrustSignal = {
  timestamp: number
  continuityPreserved: boolean
  overrideRejected: boolean
  adaptationAccepted: boolean
  trustFeedback: number
  recoveryStabilized: boolean
}

export type AdaptiveTrustModel = {
  trustStability: number
  continuityConfidence: number
  adaptationComfort: number
  regulationAcceptance: number
  trustMomentum: number
  computedAt: number
}

export type TrustRegulationRecommendation = {
  autonomyLevel: "guarded" | "balanced" | "progressive"
  explanationStyle: "minimal" | "standard" | "high-context"
  recommendHumanReview: boolean
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

export function computeAdaptiveTrustModel(signals: TrustSignal[], now = Date.now()): AdaptiveTrustModel {
  if (signals.length === 0) {
    return {
      trustStability: 0.5,
      continuityConfidence: 0.5,
      adaptationComfort: 0.5,
      regulationAcceptance: 0.5,
      trustMomentum: 0,
      computedAt: now,
    }
  }

  const continuityConfidence =
    signals.filter((signal) => signal.continuityPreserved).length / Math.max(1, signals.length)
  const adaptationComfort =
    signals.filter((signal) => signal.adaptationAccepted).length / Math.max(1, signals.length)
  const rejectionRate =
    signals.filter((signal) => signal.overrideRejected).length / Math.max(1, signals.length)
  const regulationAcceptance = clamp01(adaptationComfort * 0.75 + (1 - rejectionRate) * 0.25)
  const trustStability = clamp01(
    average(signals.map((signal) => clamp01(signal.trustFeedback))) * 0.6 +
      continuityConfidence * 0.25 +
      (signals.filter((signal) => signal.recoveryStabilized).length / Math.max(1, signals.length)) * 0.15,
  )

  const recent = signals.slice(-10)
  const older = signals.slice(Math.max(0, signals.length - 20), Math.max(0, signals.length - 10))
  const recentTrust = average(recent.map((signal) => clamp01(signal.trustFeedback)))
  const olderTrust = older.length > 0 ? average(older.map((signal) => clamp01(signal.trustFeedback))) : recentTrust
  const trustMomentum = Math.max(-1, Math.min(1, recentTrust - olderTrust))

  return {
    trustStability,
    continuityConfidence: clamp01(continuityConfidence),
    adaptationComfort: clamp01(adaptationComfort),
    regulationAcceptance,
    trustMomentum,
    computedAt: now,
  }
}

export function recommendTrustRegulation(model: AdaptiveTrustModel): TrustRegulationRecommendation {
  if (model.trustStability < 0.4 || model.regulationAcceptance < 0.4) {
    return {
      autonomyLevel: "guarded",
      explanationStyle: "high-context",
      recommendHumanReview: true,
    }
  }

  if (model.trustStability > 0.72 && model.regulationAcceptance > 0.65 && model.trustMomentum >= 0) {
    return {
      autonomyLevel: "progressive",
      explanationStyle: "minimal",
      recommendHumanReview: false,
    }
  }

  return {
    autonomyLevel: "balanced",
    explanationStyle: "standard",
    recommendHumanReview: false,
  }
}
