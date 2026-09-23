/**
 * Continuity Memory Engine
 *
 * Long-term trust and pattern preservation layer.
 * Prevents chaotic oscillation by remembering:
 * - Stable identity patterns
 * - Trusted directions
 * - Successful pacing
 * - Preferred workflows
 * - Calm interaction styles
 *
 * Purpose: Maintain consistency across weeks and months
 */

export type ContinuityPattern = {
  patternType: "identity" | "direction" | "pacing" | "workflow" | "tone"
  description: string
  confidenceScore: number // 0-1, how stable/reliable is this pattern
  lastObservedAt: Date
  frequency: number // how many times observed
  associatedMoodState: string // "accelerated" | "balanced" | "stabilizing" | "recovery" | "locked"
  successRate: number // 0-1, how often led to positive outcomes
}

export type ContinuityMemory = {
  userId: string
  patterns: ContinuityPattern[]
  steadyStateProfile: {
    preferredPacingMode: string
    typicalSessionLength: number
    mostProductiveTimeOfDay: string
    preferredWorkflowType: string
    trustedDirections: string[]
  }
  trendData: {
    stabilityScore: number // 0-1, overall pattern stability
    oscillationFrequency: number // how often does state change
    recoveryPattern: string // typical recovery sequence
    riskFactors: string[] // what disrupts equilibrium
  }
  lastUpdateAt: Date
}

/**
 * Extract continuity patterns from historical behavior
 * This would be fed from database queries in real implementation
 */
export function extractContinuityPatterns(behaviorHistory: Array<{
  timestamp: Date
  action: string
  pressureState: string
  outcome: "success" | "abandoned" | "neutral"
}>): ContinuityPattern[] {
  const patterns: ContinuityPattern[] = []

  // Group by action type to find stable patterns
  const actionCounts: Record<string, number> = {}
  const actionSuccessRates: Record<string, number> = {}

  for (const entry of behaviorHistory) {
    actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1

    if (!actionSuccessRates[entry.action]) {
      actionSuccessRates[entry.action] = 0
    }

    if (entry.outcome === "success") {
      actionSuccessRates[entry.action] += 1
    }
  }

  // Create patterns for frequently repeated actions with high success
  for (const [action, count] of Object.entries(actionCounts)) {
    if (count >= 3) {
      // Must be repeated at least 3 times
      const successRate = actionSuccessRates[action] / count
      if (successRate >= 0.6) {
        // Must have 60%+ success rate
        patterns.push({
          patternType: "workflow",
          description: `Repeating workflow: ${action}`,
          confidenceScore: Math.min(0.95, count / 10), // confidence grows with repetition
          lastObservedAt: new Date(),
          frequency: count,
          associatedMoodState: "balanced",
          successRate,
        })
      }
    }
  }

  return patterns
}

/**
 * Measure pattern stability over time
 */
export function computeStabilityScore(patterns: ContinuityPattern[]): number {
  if (patterns.length === 0) return 0

  // High-confidence, frequently-observed patterns = stability
  const avgConfidence = patterns.reduce((sum, p) => sum + p.confidenceScore, 0) / patterns.length
  const avgFrequency = Math.min(1, patterns.reduce((sum, p) => sum + p.frequency, 0) / (patterns.length * 10))
  const avgSuccess = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length

  // Weighted average: confidence is most important
  return avgConfidence * 0.5 + avgFrequency * 0.3 + avgSuccess * 0.2
}

/**
 * Detect oscillation in equilibrium state
 */
export function analyzeOscillation(pressureStateHistory: Array<{
  timestamp: Date
  state: string
}>): {
  oscillationFrequency: number // 0-1, how often does state change
  cycleLength: number // average milliseconds between state changes
  isOscillating: boolean
} {
  if (pressureStateHistory.length < 3) {
    return {
      oscillationFrequency: 0,
      cycleLength: 0,
      isOscillating: false,
    }
  }

  // Count state changes
  let changes = 0
  for (let i = 1; i < pressureStateHistory.length; i++) {
    if (pressureStateHistory[i].state !== pressureStateHistory[i - 1].state) {
      changes += 1
    }
  }

  // Compute cycle
  const timeSpan =
    pressureStateHistory[pressureStateHistory.length - 1].timestamp.getTime() -
    pressureStateHistory[0].timestamp.getTime()
  const avgCycleLength = timeSpan / Math.max(1, changes)

  // Oscillation if changes happen every < 2 hours
  const isOscillating = avgCycleLength < 2 * 60 * 60 * 1000

  return {
    oscillationFrequency: Math.min(1, changes / pressureStateHistory.length),
    cycleLength: avgCycleLength,
    isOscillating,
  }
}

/**
 * Recommend anchoring point during oscillation
 * Returns a stable pattern that user should return to
 */
export function findAnchorPattern(memory: ContinuityMemory): ContinuityPattern | null {
  // Find highest confidence pattern with recent observation
  return (
    memory.patterns
      .sort(
        (a, b) =>
          b.confidenceScore * b.successRate - (a.confidenceScore * a.successRate) ||
          b.lastObservedAt.getTime() - a.lastObservedAt.getTime(),
      )
      .at(0) || null
  )
}

/**
 * Detect disruption to continuity
 */
export function detectContinuityDisruption(
  memory: ContinuityMemory,
  recentBehavior: Array<{
    action: string
    pressureState: string
    outcome: string
  }>,
): {
  isDisrupted: boolean
  severity: number // 0-1
  disruptiveFactors: string[]
} {
  const disruptiveFactors: string[] = []
  let severityScore = 0

  // Check if recent behavior matches known patterns
  const knownActions = new Set(memory.patterns.filter((p) => p.patternType === "workflow").map((p) => p.description))

  for (const behavior of recentBehavior) {
    if (!knownActions.has(`Repeating workflow: ${behavior.action}`)) {
      disruptiveFactors.push(`Unfamiliar action: ${behavior.action}`)
      severityScore += 0.15
    }

    if (behavior.outcome === "abandoned") {
      disruptiveFactors.push(`Abandoned action: ${behavior.action}`)
      severityScore += 0.2
    }
  }

  // Check for pressure state changes
  const pressureStates = new Set(recentBehavior.map((b) => b.pressureState))
  if (pressureStates.size > 2) {
    disruptiveFactors.push(`Rapid pressure state changes`)
    severityScore += 0.3
  }

  return {
    isDisrupted: severityScore > 0.3,
    severity: Math.min(1, severityScore),
    disruptiveFactors,
  }
}
