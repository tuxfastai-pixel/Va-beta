/**
 * Recovery Intelligence & Reflection System
 *
 * Instead of merely reducing pressure:
 * actively restores equilibrium through:
 * - Progress summarization
 * - Continuity reinforcement
 * - Uncertainty reduction
 * - Direction clarification
 * - Consistency celebration
 *
 * Goal: Proactive equilibrium restoration during recovery periods
 */

import type { SystemPressureState } from "@/lib/ui/notificationOrchestrator"

export type RecoveryReflection = {
  summaryType: "progress" | "continuity" | "direction" | "stability" | "identity"
  title: string
  message: string
  actionSuggested: string | null
  emotionalTone: "celebratory" | "supportive" | "clarifying" | "grounding" | "affirming"
  relevanceScore: number // 0-1
}

export type RecoveryIntelligenceOutput = {
  currentRecoveryPhase: "acute" | "stabilizing" | "consolidating" | "integrating"
  timeEstimateMs: number // estimated recovery time remaining
  reflections: RecoveryReflection[]
  nextActionRecommendation: string | null
  continuitySafeguard: string // something to anchor to
}

/**
 * Assess recovery phase based on pressure state trajectory
 */
export function assessRecoveryPhase(pressureStateHistory: Array<{
  timestamp: Date
  state: string
}>): "acute" | "stabilizing" | "consolidating" | "integrating" {
  if (pressureStateHistory.length < 2) {
    return "acute"
  }

  // Check recent trend
  const recent = pressureStateHistory.slice(-5)
  const isStabilizing = recent.every((entry) => entry.state === "recovery" || entry.state === "stabilizing")

  if (!isStabilizing) {
    return "acute"
  }

  // Count how many recovery-state entries
  const recoveryDays = recent.filter((e) => e.state === "recovery").length

  if (recoveryDays >= 4) {
    return "consolidating"
  }

  if (recoveryDays >= 2) {
    return "stabilizing"
  }

  return "acute"
}

/**
 * Generate recovery reflections personalized to user state
 */
export function generateRecoveryReflections(context: {
  recentCompletions: string[]
  recentAbandoned: string[]
  pressureState: SystemPressureState
  fatigueRisk: number // 0-1
  trustScore: number // 0-1
  identityStable: boolean
}): RecoveryReflection[] {
  const reflections: RecoveryReflection[] = []

  // Progress reflection
  if (context.recentCompletions.length > 0) {
    reflections.push({
      summaryType: "progress",
      title: "Progress Checkpoint",
      message: `You've completed ${context.recentCompletions.length} action${context.recentCompletions.length !== 1 ? "s" : ""}. That's real forward motion.`,
      actionSuggested: null,
      emotionalTone: "celebratory",
      relevanceScore: 0.9,
    })
  }

  // Continuity reflection
  if (context.identityStable) {
    reflections.push({
      summaryType: "continuity",
      title: "Your Direction Holds",
      message: "Even during pressure, your core direction has stayed steady. That's continuity.",
      actionSuggested: null,
      emotionalTone: "affirming",
      relevanceScore: 0.85,
    })
  }

  // Direction clarification
  if (context.fatigueRisk > 0.6) {
    reflections.push({
      summaryType: "direction",
      title: "Focusing Your Energy",
      message: "When overwhelmed, clarity helps. Let's confirm what matters most right now.",
      actionSuggested: "Identify your top 3 priorities",
      emotionalTone: "clarifying",
      relevanceScore: 0.8,
    })
  }

  // Stability reflection
  if (context.pressureState === "recovery") {
    reflections.push({
      summaryType: "stability",
      title: "Building Stability",
      message: "Recovery isn't about doing more. It's about returning to what works. Your rhythm matters.",
      actionSuggested: null,
      emotionalTone: "grounding",
      relevanceScore: 0.75,
    })
  }

  // Identity reflection
  if (context.trustScore > 0.6) {
    reflections.push({
      summaryType: "identity",
      title: "Your Patterns Hold Strength",
      message: "System knows you well enough to notice: your patterns are solid. Trust them.",
      actionSuggested: null,
      emotionalTone: "supportive",
      relevanceScore: 0.7,
    })
  }

  return reflections.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3)
}

/**
 * Estimate recovery time based on current state
 */
export function estimateRecoveryTime(context: {
  fatigueRisk: number // 0-1
  pressureState: SystemPressureState
  recentOscillations: number // how many state changes in last 24h
  trustScore: number // 0-1
}): number {
  // Base recovery time in milliseconds
  let recoveryMs = 2 * 60 * 60 * 1000 // 2 hours baseline

  // Adjust by fatigue severity
  if (context.fatigueRisk > 0.78) {
    recoveryMs = 6 * 60 * 60 * 1000 // 6 hours for severe
  } else if (context.fatigueRisk > 0.6) {
    recoveryMs = 4 * 60 * 60 * 1000 // 4 hours for moderate
  } else if (context.fatigueRisk > 0.34) {
    recoveryMs = 2 * 60 * 60 * 1000 // 2 hours for mild
  }

  // Oscillation compounds recovery time
  if (context.recentOscillations > 3) {
    recoveryMs *= 1.5 // 50% longer if chaotic
  }

  // Trust accelerates recovery
  if (context.trustScore > 0.7) {
    recoveryMs *= 0.8 // 20% faster with high trust
  }

  return recoveryMs
}

/**
 * Generate continuity safeguard for recovery state
 */
export function generateContinuitySafeguard(context: {
  stablePatterns: string[]
  successfulWorkflows: string[]
  trustDirection: string | null
  identityCore: string | null
}): string {
  // Pick strongest anchor
  if (context.identityCore) {
    return `Your core identity: ${context.identityCore}`
  }

  if (context.trustDirection) {
    return `Your trusted direction: ${context.trustDirection}`
  }

  if (context.stablePatterns.length > 0) {
    return `Your strongest pattern: ${context.stablePatterns[0]}`
  }

  if (context.successfulWorkflows.length > 0) {
    return `Your proven workflow: ${context.successfulWorkflows[0]}`
  }

  return "Your consistency is your anchor"
}

/**
 * Suggest next action during recovery
 */
export function suggestRecoveryAction(context: {
  phase: "acute" | "stabilizing" | "consolidating" | "integrating"
  fatigueRisk: number // 0-1
  completionRate: number // 0-1
  sessionDurationMs: number
}): string | null {
  if (context.phase === "acute") {
    if (context.sessionDurationMs > 30 * 60 * 1000) {
      return "Take a break. Let yourself rest for 10 minutes."
    }
    return null
  }

  if (context.phase === "stabilizing") {
    if (context.completionRate < 0.5) {
      return "Pick one simple task and complete it. One success builds momentum."
    }
    return "You're stabilizing. Let's continue at a gentle pace."
  }

  if (context.phase === "consolidating") {
    return "Your equilibrium is returning. Consider what helped stabilize you."
  }

  if (context.phase === "integrating") {
    return "You've recovered well. Ready to rebuild your rhythm?"
  }

  return null
}

/**
 * Compute recovery confidence: how likely is recovery to succeed
 */
export function computeRecoveryConfidence(context: {
  trustScore: number // 0-1, system understands user
  identityStability: number // 0-1, direction is clear
  pastRecoverySuccessRate: number // 0-1, how often did user recover before
  recentMotivation: number // 0-1, how motivated is user now
}): number {
  // High confidence if system knows user and user has succeeded before
  const confidence =
    context.trustScore * 0.3 + // system knowledge
    context.identityStability * 0.3 + // clear direction
    context.pastRecoverySuccessRate * 0.2 + // past success
    context.recentMotivation * 0.2 // current motivation

  return Math.min(1, confidence)
}
