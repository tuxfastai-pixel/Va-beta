/**
 * Autonomous Equilibrium Controller
 *
 * Master adaptive coordinator that continuously tunes:
 * - Pacing
 * - Notification density
 * - Session complexity
 * - Workspace shape
 * - Workflow breadth
 * - Communication tone
 * - Recovery intensity
 *
 * Purpose: Maintain sustainable long-term human-system equilibrium
 *
 * This is the true orchestrator brain.
 */

import type { SystemPressureState } from "../ui/notificationOrchestrator.ts"
import type { SessionShape } from "../ui/adaptiveSessionEngine.ts"
import { computeEffectiveSessionShape } from "../ui/adaptiveSessionEngine.ts"
import type { CognitiveBudget, CognitiveBudgetInput } from "./cognitiveBudgetEngine.ts"
import { computeCognitiveBudget } from "./cognitiveBudgetEngine.ts"
import type { SessionRhythm } from "../ui/sessionRhythmEngine.ts"
import { getSessionRhythmForState } from "../ui/sessionRhythmEngine.ts"
import type { CompanionToneConfig } from "../ui/adaptiveCompanionTone.ts"
import { getToneConfigForState } from "../ui/adaptiveCompanionTone.ts"
import type { TrustContinuityScore } from "./trustContinuityScore.ts"
import { computeTrustContinuityScore } from "./trustContinuityScore.ts"
import { predictFatigue, type FatiguePrediction } from "../ui/predictiveFatigueModel.ts"
import type { FatigueInputs } from "../ui/predictiveFatigueModel.ts"

export type EquilibriumState = {
  timestamp: Date
  pressureState: SystemPressureState
  fatigueRisk: number // 0-1
  sessionShape: SessionShape
  cognitiveBudget: CognitiveBudget
  sessionRhythm: SessionRhythm
  companionTone: CompanionToneConfig
  trustContinuity: TrustContinuityScore
  overallHealth: number // 0-1, meta health score
  adaptationLevel: number // 0-1, how much is system adapting
  stabilityForecast: number // 0-1, is system stable or at risk
}

/**
 * Compute complete equilibrium state from raw inputs
 */
export function computeEquilibriumState(inputs: {
  pressureState: SystemPressureState
  fatigueInputs: FatigueInputs
  cognitiveBudgetInputs: CognitiveBudgetInput
  trustContinuityInputs: import("./trustContinuityScore").TrustContinuityInput
  sessionDurationMs: number
  completionRate: number
}): EquilibriumState {
  // Compute all subsystems
  const fatiguePrediction = predictFatigue(inputs.fatigueInputs)
  const sessionShape = computeEffectiveSessionShape(inputs.pressureState, fatiguePrediction.fatigueRisk)
  const cognitiveBudget = computeCognitiveBudget(inputs.cognitiveBudgetInputs)
  const sessionRhythm = getSessionRhythmForState(inputs.pressureState, inputs.sessionDurationMs, inputs.completionRate)
  const companionTone = getToneConfigForState(inputs.pressureState)
  const trustContinuity = computeTrustContinuityScore(inputs.trustContinuityInputs)

  // Meta health: composite of subsystem health
  const overallHealth =
    (1 - fatiguePrediction.fatigueRisk) * 0.25 + // fatigue is bad
    cognitiveBudget.remainingCapacity * 0.25 + // budget depletion is bad
    trustContinuity.overallScore * 0.25 + // low trust is bad
    (1 - cognitiveBudget.overloadRisk) * 0.25 // overload is bad

  // Adaptation level: how much is system actively adapting
  const adaptationLevel = Math.min(
    1,
    (sessionShape.workspaceMode === "expanded" ? 0 : 0.3) + // expanded = less adaptation needed
      (cognitiveBudget.overloadRisk > 0.5 ? 0.7 : 0) + // high overload = strong adaptation
      (fatiguePrediction.fatigueRisk > 0.6 ? 0.5 : 0) + // high fatigue = significant adaptation
      (inputs.pressureState === "recovery" || inputs.pressureState === "locked" ? 0.6 : 0), // recovery/locked = strong adaptation
  )

  // Stability forecast: 1 = stable, 0 = at risk
  const stabilityForecast =
    (1 - fatiguePrediction.fatigueRisk) * 0.3 + // fatigue threatens stability
    (1 - cognitiveBudget.overloadRisk) * 0.3 + // overload threatens stability
    (trustContinuity.coherenceScore) * 0.2 + // low coherence threatens stability
    (sessionRhythm.engagementPressure < 0.8 ? 0.7 : 0.3) * 0.2 // high pressure threatens stability

  return {
    timestamp: new Date(),
    pressureState: inputs.pressureState,
    fatigueRisk: fatiguePrediction.fatigueRisk,
    sessionShape,
    cognitiveBudget,
    sessionRhythm,
    companionTone,
    trustContinuity,
    overallHealth,
    adaptationLevel,
    stabilityForecast,
  }
}

/**
 * Compute next equilibrium state: what should system become
 */
export function computeTargetEquilibrium(
  currentState: EquilibriumState,
  userInput: {
    recentCompletions: number
    recentAbandoned: number
    userEngagement: number // 0-1
    explicitFeedback: string | null
  },
): SystemPressureState {
  // Base recommendation from current state
  let recommendation = currentState.pressureState

  // If user is succeeding, can increase complexity gradually (one level at a time)
  if (userInput.recentCompletions > userInput.recentAbandoned && currentState.fatigueRisk < 0.4) {
    if (recommendation === "recovery") recommendation = "stabilizing"
    else if (recommendation === "stabilizing") recommendation = "balanced"
    else if (recommendation === "balanced") recommendation = "accelerated"
  }

  // If fatigue is rising, downshift
  if (currentState.fatigueRisk > 0.7) {
    if (recommendation === "accelerated") recommendation = "balanced"
    if (recommendation === "balanced") recommendation = "stabilizing"
    if (recommendation === "stabilizing") recommendation = "recovery"
  }

  // If cognitive budget is depleted, downshift
  if (currentState.cognitiveBudget.remainingCapacity < 0.2) {
    if (recommendation !== "locked" && recommendation !== "recovery") {
      recommendation = "recovery"
    }
  }

  // If oscillating, stabilize
  if (currentState.trustContinuity.coherenceScore < 0.4) {
    recommendation = "stabilizing"
  }

  return recommendation
}

/**
 * Detect equilibrium breaches: when system health is threatened
 */
export function detectEquilibriumBreach(state: EquilibriumState): {
  isBreach: boolean
  severity: number // 0-1
  factors: string[]
  recommendation: string
} {
  const factors: string[] = []
  let severity = 0

  // Critical fatigue
  if (state.fatigueRisk > 0.78) {
    factors.push("Critical fatigue risk")
    severity += 0.3
  }

  // Cognitive budget critical
  if (state.cognitiveBudget.remainingCapacity < 0.15) {
    factors.push("Cognitive budget critical")
    severity += 0.3
  }

  // High overload risk
  if (state.cognitiveBudget.overloadRisk > 0.8) {
    factors.push("High overload risk")
    severity += 0.2
  }

  // Low trust
  if (state.trustContinuity.overallScore < 0.3) {
    factors.push("Low system trust")
    severity += 0.15
  }

  // Low coherence (oscillating)
  if (state.trustContinuity.coherenceScore < 0.2) {
    factors.push("System oscillating")
    severity += 0.2
  }

  const isBreach = severity > 0.5
  let recommendation = ""

  if (isBreach) {
    if (state.fatigueRisk > 0.78 || state.cognitiveBudget.remainingCapacity < 0.15) {
      recommendation = "Enter locked state. Identity continuity only. Pause all non-essential activity."
    } else if (state.fatigueRisk > 0.6 || state.cognitiveBudget.overloadRisk > 0.8) {
      recommendation = "Enter recovery state. Guided focus. Restore equilibrium."
    } else if (state.trustContinuity.coherenceScore < 0.2) {
      recommendation = "Enter stabilizing state. Reduce oscillation. Return to proven patterns."
    }
  }

  return {
    isBreach,
    severity: Math.min(1, severity),
    factors,
    recommendation,
  }
}

/**
 * Suggest tactical adjustments within current equilibrium
 */
export function suggestTacticalAdjustments(state: EquilibriumState): {
  immediateActions: string[]
  deferred: string[]
  paused: string[]
} {
  const immediateActions: string[] = []
  const deferred: string[] = []
  const paused: string[] = []

  // Based on cognitive budget
  if (state.cognitiveBudget.remainingCapacity < 0.4) {
    deferred.push("Complex decision-making")
    paused.push("Multi-step workflows")
  }

  // Based on fatigue
  if (state.fatigueRisk > 0.6) {
    paused.push("Rapid action execution")
    deferred.push("New learning activities")
    immediateActions.push("Take a break")
  }

  // Based on trust coherence
  if (state.trustContinuity.coherenceScore < 0.4) {
    immediateActions.push("Return to proven patterns")
    paused.push("Experimentation")
  }

  // Based on budget and fatigue combined
  if (state.cognitiveBudget.overloadRisk > 0.7 && state.fatigueRisk > 0.5) {
    paused.push("All non-critical actions")
    immediateActions.push("Focus on one thing")
  }

  return { immediateActions, deferred, paused }
}

/**
 * Generate equilibrium status report
 */
export function generateEquilibriumReport(state: EquilibriumState): {
  headline: string
  body: string
  alerts: string[]
  recommendations: string[]
} {
  let headline = ""
  const alerts: string[] = []
  const recommendations: string[] = []

  // Headline based on overall health
  if (state.overallHealth > 0.8) {
    headline = "Equilibrium Strong"
  } else if (state.overallHealth > 0.6) {
    headline = "Equilibrium Stable"
  } else if (state.overallHealth > 0.4) {
    headline = "Equilibrium Shifting"
  } else if (state.overallHealth > 0.2) {
    headline = "Equilibrium Under Stress"
  } else {
    headline = "Equilibrium Critical"
  }

  // Build body
  let body = `System health: ${Math.round(state.overallHealth * 100)}%. `

  if (state.fatigueRisk > 0.6) {
    alerts.push(`Fatigue risk is ${Math.round(state.fatigueRisk * 100)}%`)
    body += `Fatigue is rising. `
  }

  if (state.cognitiveBudget.remainingCapacity < 0.3) {
    alerts.push("Cognitive budget is low")
    body += `Capacity is limited. `
  }

  if (state.trustContinuity.overallScore > 0.7) {
    body += `System knows you well. `
  }

  // Recommendations
  if (state.pressureState === "locked" || state.pressureState === "recovery") {
    recommendations.push("Continue with guided simplicity")
  } else if (state.overallHealth < 0.5) {
    recommendations.push("Consider reducing complexity")
  }

  if (state.trustContinuity.coherenceScore < 0.4) {
    recommendations.push("Return to your proven patterns")
  }

  return { headline, body, alerts, recommendations }
}
