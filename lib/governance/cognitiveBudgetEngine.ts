/**
 * Cognitive Load Budget System
 *
 * Allocates and tracks a live "cognitive budget" that represents how much complexity,
 * interruption, and decision-making the user can safely handle without overload.
 *
 * Tracks: decision fatigue, interaction strain, context switching, interruption accumulation, refinement exhaustion
 */

export type CognitiveBudget = {
  remainingCapacity: number // 0-1, where 1 is full capacity
  overloadRisk: number // 0-1, where 1 is critical overload
  recommendedComplexity: number // 0-1, max action complexity safe to present
  interruptionAllowance: number // 0-1, how many more interruptions are safe
  decisionFatigueFactor: number // 0-1, fatigue from decision volume
  contextSwitchCost: number // 0-1, cost of switching contexts
  refinementExhaustion: number // 0-1, fatigue from refinement cycles
  nextRestWindow: number // milliseconds until suggested break
  budgetRecoveryRate: number // how fast budget recovers (0-1)
}

export type CognitiveBudgetInput = {
  decisionCount24h: number // total decisions made in last 24h
  interactionCount1h: number // interactions in last hour
  contextSwitches1h: number // context switches in last hour
  averageTaskDepth: number // avg refinement loops per task
  sessionDurationMs: number // current session duration
  notificationIgnoreRate: number // % of notifications ignored (0-1)
  actionsCompleted: number // actions completed successfully
  actionsAbandoned: number // actions abandoned midway
  userVelocity: number // task completion rate (0-1)
}

/**
 * Compute cognitive budget from behavioral signals
 *
 * This represents real cognitive capacity, not just fatigue prediction.
 * Budget is consumed by:
 * - Decision volume (each decision costs capacity)
 * - Interruptions (each interruption has attention tax)
 * - Context switching (expensive cognitive operation)
 * - Refinement cycles (repeated tries exhaust capacity)
 * - Task complexity (harder tasks consume more budget)
 */
export function computeCognitiveBudget(inputs: CognitiveBudgetInput): CognitiveBudget {
  // Base capacity starts at 1.0, consumed by various stressors
  let consumedCapacity = 0

  // Decision fatigue: 100+ decisions in 24h is exhausting
  const decisionFactor = Math.min(1, inputs.decisionCount24h / 100)
  consumedCapacity += decisionFactor * 0.25 // decisions consume up to 25% of budget

  // Interruption strain: context tax compounds quickly
  const interruptionFactor = Math.min(1, inputs.interactionCount1h / 20)
  consumedCapacity += interruptionFactor * 0.2 // interruptions consume up to 20%

  // Context switching cost: expensive cognitive operation
  const contextSwitchFactor = Math.min(1, inputs.contextSwitches1h / 10)
  consumedCapacity += contextSwitchFactor * 0.2 // switching costs up to 20%

  // Refinement exhaustion: repeated cycles wear down capacity
  const refinementFactor = Math.min(1, inputs.averageTaskDepth / 5)
  consumedCapacity += refinementFactor * 0.2 // refinement costs up to 20%

  // Session duration: longer sessions deplete budget
  const sessionHours = inputs.sessionDurationMs / (1000 * 60 * 60)
  const sessionFatigue = Math.min(1, sessionHours / 4) // 4+ hour sessions are exhausting
  consumedCapacity += sessionFatigue * 0.15 // session duration costs up to 15%

  // Clamping to valid range
  consumedCapacity = Math.max(0, Math.min(1, consumedCapacity))
  const remainingCapacity = 1 - consumedCapacity

  // Overload risk: non-linear curve, sharp increase near zero capacity
  const overloadRisk = 1 - Math.pow(Math.max(0, remainingCapacity), 1.5)

  // Task completion efficiency affects recovery rate
  const completionRate =
    inputs.actionsCompleted + inputs.actionsAbandoned > 0
      ? inputs.actionsCompleted / (inputs.actionsCompleted + inputs.actionsAbandoned)
      : 0.5

  // Recovery rate: faster if user is succeeding, slower if struggling
  let budgetRecoveryRate = 0.5 + completionRate * 0.3 // 0.5-0.8 range

  // Slow recovery if high ignore rate (user is overwhelmed)
  if (inputs.notificationIgnoreRate > 0.5) {
    budgetRecoveryRate *= 0.6
  }

  // Recommended complexity: safe to present is inverse of consumed capacity
  const recommendedComplexity = remainingCapacity * 0.8 // leave margin

  // Interruption allowance: how many more safe
  const maxSafeInterruptions = 20 // baseline
  const currentInterruptions = inputs.interactionCount1h
  const interruptionAllowance = Math.max(0, Math.min(1, (maxSafeInterruptions - currentInterruptions) / maxSafeInterruptions))

  // Suggest break if session is long and capacity is consumed
  let nextRestWindow = Infinity
  if (sessionHours > 1.5 && remainingCapacity < 0.4) {
    nextRestWindow = 5 * 60 * 1000 // suggest break in 5 minutes
  } else if (sessionHours > 2.5) {
    nextRestWindow = 10 * 60 * 1000 // suggest break in 10 minutes
  }

  return {
    remainingCapacity,
    overloadRisk,
    recommendedComplexity,
    interruptionAllowance,
    decisionFatigueFactor: decisionFactor,
    contextSwitchCost: contextSwitchFactor,
    refinementExhaustion: refinementFactor,
    nextRestWindow,
    budgetRecoveryRate,
  }
}

/**
 * Determine if action is safe given cognitive budget
 */
export function isActionSafeUnderBudget(
  action: { complexity: number; interruptive: boolean; requiresDecision: boolean },
  budget: CognitiveBudget,
): boolean {
  // Never allow complex actions if overload risk is critical
  if (budget.overloadRisk > 0.8) {
    return !action.requiresDecision
  }

  // Don't interrupt if no allowance remaining
  if (action.interruptive && budget.interruptionAllowance < 0.1) {
    return false
  }

  // Check complexity against recommended
  if (action.complexity > budget.recommendedComplexity) {
    return false
  }

  return true
}

/**
 * Suggest action modifications to fit within budget
 */
export function suggestActionSimplification(
  action: { complexity: number; steps: number; options: number; interruptive: boolean },
  budget: CognitiveBudget,
): Partial<typeof action> {
  const suggestions: Partial<typeof action> = {}

  if (action.complexity > budget.recommendedComplexity) {
    // Reduce steps if action is too complex
    const maxSteps = Math.max(1, Math.ceil(action.steps * budget.recommendedComplexity))
    if (maxSteps < action.steps) {
      suggestions.steps = maxSteps
    }

    // Reduce option presentation
    const maxOptions = Math.max(1, Math.ceil(action.options * budget.recommendedComplexity))
    if (maxOptions < action.options) {
      suggestions.options = maxOptions
    }
  }

  // Defer interruption if budget doesn't allow
  if (action.interruptive && budget.interruptionAllowance < 0.3) {
    suggestions.interruptive = false
  }

  return suggestions
}
