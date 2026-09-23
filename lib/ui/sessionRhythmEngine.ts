/**
 * Session Rhythm Intelligence
 *
 * Regulates session cadence, break timing, action pacing, and continuation momentum.
 * Prevents both burnout (too much) and disengagement (too little).
 *
 * Goal: Sustainable engagement rhythm that matches current equilibrium state
 */

import type { SystemPressureState } from "@/lib/ui/notificationOrchestrator"

export type SessionRhythm = {
  recommendedSessionLength: number // milliseconds
  suggestedBreakWindow: number // milliseconds until suggested break
  engagementPressure: number // 0-1, how much to encourage continuation
  pacingMode: "accelerated" | "balanced" | "stabilizing" | "recovery" | "continuity"
  batchSize: number // recommended actions to present at once
  delayBetweenActions: number // milliseconds between suggested actions
  breakDurationMs: number // suggested break length
  continueEncouragement: boolean // should system encourage continuation
  dailySessionTarget: number // recommended daily session total
}

/**
 * Compute recommended session rhythm based on equilibrium state
 */
export function getSessionRhythmForState(
  pressureState: SystemPressureState,
  sessionDurationMs: number, // how long current session has been active
  completionRate: number, // 0-1, % of actions completed
): SessionRhythm {
  const sessionMinutes = sessionDurationMs / (1000 * 60)

  if (pressureState === "locked") {
    // Minimal engagement, focus on continuity
    return {
      recommendedSessionLength: 15 * 60 * 1000, // 15 minutes
      suggestedBreakWindow: Infinity, // no break suggested during minimal session
      engagementPressure: 0,
      pacingMode: "continuity",
      batchSize: 1,
      delayBetweenActions: 60 * 1000, // 60 seconds between actions
      breakDurationMs: 5 * 60 * 1000, // 5 minute break
      continueEncouragement: false,
      dailySessionTarget: 30 * 60 * 1000, // 30 minutes total
    }
  }

  if (pressureState === "recovery") {
    // Guided, slow pacing
    return {
      recommendedSessionLength: 25 * 60 * 1000, // 25 minutes (Pomodoro)
      suggestedBreakWindow: sessionMinutes > 20 ? 0 : 25 * 60 * 1000,
      engagementPressure: 0.2,
      pacingMode: "recovery",
      batchSize: 2,
      delayBetweenActions: 45 * 1000, // 45 seconds
      breakDurationMs: 5 * 60 * 1000, // 5 minute break
      continueEncouragement: completionRate > 0.7, // only if succeeding
      dailySessionTarget: 90 * 60 * 1000, // 90 minutes total
    }
  }

  if (pressureState === "stabilizing") {
    // Moderate pacing, focus on consistency
    return {
      recommendedSessionLength: 45 * 60 * 1000, // 45 minutes
      suggestedBreakWindow: sessionMinutes > 40 ? 0 : 45 * 60 * 1000,
      engagementPressure: 0.5,
      pacingMode: "stabilizing",
      batchSize: 3,
      delayBetweenActions: 30 * 1000, // 30 seconds
      breakDurationMs: 10 * 60 * 1000, // 10 minute break
      continueEncouragement: true,
      dailySessionTarget: 180 * 60 * 1000, // 3 hours total
    }
  }

  if (pressureState === "accelerated") {
    // High velocity, encourage extended sessions
    return {
      recommendedSessionLength: 90 * 60 * 1000, // 90 minutes
      suggestedBreakWindow: sessionMinutes > 85 ? 0 : 90 * 60 * 1000,
      engagementPressure: 0.8,
      pacingMode: "accelerated",
      batchSize: 5,
      delayBetweenActions: 10 * 1000, // 10 seconds
      breakDurationMs: 15 * 60 * 1000, // 15 minute break
      continueEncouragement: true,
      dailySessionTarget: 360 * 60 * 1000, // 6 hours total
    }
  }

  // Default: balanced state
  return {
    recommendedSessionLength: 60 * 60 * 1000, // 60 minutes
    suggestedBreakWindow: sessionMinutes > 55 ? 0 : 60 * 60 * 1000,
    engagementPressure: 0.6,
    pacingMode: "balanced",
    batchSize: 4,
    delayBetweenActions: 20 * 1000, // 20 seconds
    breakDurationMs: 10 * 60 * 1000, // 10 minute break
    continueEncouragement: true,
    dailySessionTarget: 240 * 60 * 1000, // 4 hours total
  }
}

/**
 * Suggest break based on session state
 */
export function shouldSuggestBreak(
  sessionDurationMs: number,
  completionRate: number,
  userFatigueRisk: number,
  rhythm: SessionRhythm,
): boolean {
  if (rhythm.suggestedBreakWindow === Infinity) {
    return false
  }

  const sessionMinutes = sessionDurationMs / (1000 * 60)

  // Time-based break suggestion
  if (sessionMinutes >= rhythm.recommendedSessionLength / (1000 * 60)) {
    return true
  }

  // Fatigue-based break suggestion
  if (userFatigueRisk > 0.6 && sessionMinutes > 20) {
    return true
  }

  // Low completion rate suggests break to reset
  if (completionRate < 0.3 && sessionMinutes > 30) {
    return true
  }

  return false
}

/**
 * Compute engagement message based on rhythm and performance
 */
export function getEngagementMessage(
  rhythm: SessionRhythm,
  sessionDurationMs: number,
  completionRate: number,
): string | null {
  const sessionMinutes = sessionDurationMs / (1000 * 60)

  if (rhythm.continueEncouragement && completionRate > 0.7) {
    if (sessionMinutes > rhythm.recommendedSessionLength / (1000 * 60) * 0.8) {
      return `You're on a roll. Consider a break after this action?`
    }
    return `Great progress. Keep going.`
  }

  if (completionRate < 0.3 && sessionMinutes > 15) {
    return `Take a moment to refresh. You'll do better after a short break.`
  }

  if (sessionMinutes > rhythm.recommendedSessionLength / (1000 * 60)) {
    return `You've been at this for a while. Time for a break?`
  }

  return null
}

/**
 * Estimate total daily session capacity based on equilibrium state
 */
export function estimateDailySessionCapacity(
  averagePressureState: SystemPressureState,
  userConsistency: number, // 0-1, how stable user's patterns are
): number {
  // Base capacity from pressure state
  const rhythm = getSessionRhythmForState(averagePressureState, 0, 0.5)
  let capacity = rhythm.dailySessionTarget

  // Adjust for consistency
  // Stable users can maintain higher daily engagement
  capacity *= 0.8 + userConsistency * 0.4 // 0.8-1.2x multiplier

  return capacity
}
