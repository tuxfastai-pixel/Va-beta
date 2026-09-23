import type { SessionContinuityRecord } from "../continuity/sessionContinuityStore.ts"
import type { TrustHistoryRecord } from "../trust/trustHistoryStore.ts"

export type RecoveryStrategyLearning = {
  strategy: string
  attempts: number
  successRate: number
  averageConfidence: number
  trustLiftEstimate: number
  fatigueReductionEstimate: number
  pacingStabilizationEstimate: number
  effectivenessScore: number
}

export type RecoveryEffectivenessSummary = {
  userId: string
  overallResponsiveness: number
  fastestRecoveryStrategies: string[]
  highestTrustLiftStrategies: string[]
  mostStabilizingStrategies: string[]
  strategies: RecoveryStrategyLearning[]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function summarizeRecoveryEffectiveness(input: {
  continuityRecord: SessionContinuityRecord | null
  trustRecord: TrustHistoryRecord
}): RecoveryEffectivenessSummary {
  const recoveryHistory = input.continuityRecord?.equilibriumRecoveryHistory.slice(-180) ?? []
  const trustOutcomes = input.trustRecord.recoveryOutcomes.slice(-180)

  const grouped = new Map<
    string,
    {
      success: number[]
      confidence: number[]
      trustLift: number[]
      fatigueReduction: number[]
      pacingStabilization: number[]
    }
  >()

  for (const entry of recoveryHistory) {
    const strategy = entry.strategy || "unknown"
    const existing = grouped.get(strategy) ?? {
      success: [],
      confidence: [],
      trustLift: [],
      fatigueReduction: [],
      pacingStabilization: [],
    }

    existing.success.push(entry.confidence >= 0.55 ? 1 : 0)
    existing.confidence.push(entry.confidence)
    existing.trustLift.push(entry.phase === "stabilize" ? entry.confidence : entry.confidence * 0.8)
    existing.fatigueReduction.push(entry.phase === "recover" || entry.phase === "stabilize" ? entry.confidence : entry.confidence * 0.75)
    existing.pacingStabilization.push(entry.phase === "stabilize" ? entry.confidence : entry.confidence * 0.7)

    grouped.set(strategy, existing)
  }

  for (const outcome of trustOutcomes) {
    const strategy = outcome.strategy || "unknown"
    const existing = grouped.get(strategy) ?? {
      success: [],
      confidence: [],
      trustLift: [],
      fatigueReduction: [],
      pacingStabilization: [],
    }

    existing.success.push(outcome.successful ? 1 : 0)
    existing.confidence.push(outcome.userConfidence)
    existing.trustLift.push(outcome.userConfidence)
    existing.fatigueReduction.push(outcome.successful ? outcome.userConfidence : outcome.userConfidence * 0.4)
    existing.pacingStabilization.push(outcome.successful ? outcome.userConfidence : outcome.userConfidence * 0.5)
    grouped.set(strategy, existing)
  }

  const strategies: RecoveryStrategyLearning[] = []
  for (const [strategy, values] of grouped.entries()) {
    const attempts = values.success.length
    if (attempts <= 0) {
      continue
    }

    const successRate = average(values.success)
    const averageConfidence = average(values.confidence)
    const trustLiftEstimate = average(values.trustLift)
    const fatigueReductionEstimate = average(values.fatigueReduction)
    const pacingStabilizationEstimate = average(values.pacingStabilization)

    const effectivenessScore = clamp01(
      successRate * 0.35 +
        averageConfidence * 0.2 +
        trustLiftEstimate * 0.2 +
        fatigueReductionEstimate * 0.15 +
        pacingStabilizationEstimate * 0.1,
    )

    strategies.push({
      strategy,
      attempts,
      successRate,
      averageConfidence,
      trustLiftEstimate,
      fatigueReductionEstimate,
      pacingStabilizationEstimate,
      effectivenessScore,
    })
  }

  strategies.sort((a, b) => b.effectivenessScore - a.effectivenessScore)

  const overallResponsiveness =
    strategies.length > 0 ? clamp01(average(strategies.map((strategy) => strategy.effectivenessScore))) : 0.5

  return {
    userId: input.trustRecord.userId,
    overallResponsiveness,
    fastestRecoveryStrategies: [...strategies]
      .sort((a, b) => b.fatigueReductionEstimate - a.fatigueReductionEstimate)
      .slice(0, 5)
      .map((strategy) => strategy.strategy),
    highestTrustLiftStrategies: [...strategies]
      .sort((a, b) => b.trustLiftEstimate - a.trustLiftEstimate)
      .slice(0, 5)
      .map((strategy) => strategy.strategy),
    mostStabilizingStrategies: [...strategies]
      .sort((a, b) => b.pacingStabilizationEstimate - a.pacingStabilizationEstimate)
      .slice(0, 5)
      .map((strategy) => strategy.strategy),
    strategies,
  }
}
