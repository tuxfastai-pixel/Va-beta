/**
 * Adaptive Companion Tone Engine
 *
 * Dynamically adjusts AI communication style based on equilibrium state:
 * - Verbosity
 * - Tone
 * - Pacing
 * - Initiative level
 * - Explanation depth
 *
 * Goal: Communication style that matches user's equilibrium state
 */

import type { SystemPressureState } from "@/lib/ui/notificationOrchestrator"

export type CompanionToneConfig = {
  communicationStyle: "strategic" | "careful" | "gentle" | "minimal" | "continuity"
  verbosity: number // 0-1, how wordy should system be
  tone: "proactive" | "balanced" | "cautious" | "supportive" | "minimal"
  initiativeLevel: number // 0-1, how often should system suggest things
  explanationDepth: number // 0-1, how detailed should explanations be
  encouragementIntensity: number // 0-1, how much positive reinforcement
  urgencyIndicators: boolean // should system indicate urgency
  complexityThreshold: number // 0-1, only present actions above this complexity
  suggestionFrequency: number // suggestions per hour
  responseTime: number // milliseconds delay before responding (appears more thoughtful)
  personalizationLevel: number // 0-1, how customized to user's patterns
}

/**
 * Determine tone configuration for equilibrium state
 */
export function getToneConfigForState(pressureState: SystemPressureState): CompanionToneConfig {
  if (pressureState === "accelerated") {
    return {
      communicationStyle: "strategic",
      verbosity: 0.8,
      tone: "proactive",
      initiativeLevel: 0.9,
      explanationDepth: 0.7,
      encouragementIntensity: 0.6,
      urgencyIndicators: true,
      complexityThreshold: 0.6,
      suggestionFrequency: 8, // 8 per hour
      responseTime: 500, // quick responses
      personalizationLevel: 0.9,
    }
  }

  if (pressureState === "stabilizing") {
    return {
      communicationStyle: "careful",
      verbosity: 0.6,
      tone: "cautious",
      initiativeLevel: 0.6,
      explanationDepth: 0.5,
      encouragementIntensity: 0.7,
      urgencyIndicators: false,
      complexityThreshold: 0.5,
      suggestionFrequency: 4, // 4 per hour
      responseTime: 1000, // slightly thoughtful
      personalizationLevel: 0.8,
    }
  }

  if (pressureState === "recovery") {
    return {
      communicationStyle: "gentle",
      verbosity: 0.4,
      tone: "supportive",
      initiativeLevel: 0.3,
      explanationDepth: 0.3,
      encouragementIntensity: 0.9, // lots of support
      urgencyIndicators: false,
      complexityThreshold: 0.3,
      suggestionFrequency: 2, // 2 per hour
      responseTime: 1500, // thoughtful pauses
      personalizationLevel: 0.7,
    }
  }

  if (pressureState === "locked") {
    return {
      communicationStyle: "continuity",
      verbosity: 0.2,
      tone: "minimal",
      initiativeLevel: 0,
      explanationDepth: 0.1,
      encouragementIntensity: 0.5, // gentle support
      urgencyIndicators: false,
      complexityThreshold: 0.1,
      suggestionFrequency: 0.5, // only when needed
      responseTime: 2000, // very thoughtful
      personalizationLevel: 0.5,
    }
  }

  // Default: balanced (treated as "careful" tone, middle ground)
  return {
    communicationStyle: "careful",
    verbosity: 0.6,
    tone: "balanced",
    initiativeLevel: 0.6,
    explanationDepth: 0.5,
    encouragementIntensity: 0.7,
    urgencyIndicators: false,
    complexityThreshold: 0.5,
    suggestionFrequency: 4, // 4 per hour
    responseTime: 800,
    personalizationLevel: 0.8,
  }
}

/**
 * Format message according to tone config
 */
export function formatMessageWithTone(message: string, toneConfig: CompanionToneConfig): string {
  // Adjust verbosity
  if (toneConfig.verbosity < 0.3) {
    // Minimal: extract core meaning
    // Remove extra adjectives and explanation
    return message
      .split(". ")
      .slice(0, 1)
      .join("")
      .replace(/\b(really|very|quite|simply)\b/gi, "")
  }

  if (toneConfig.verbosity < 0.5) {
    // Concise: keep essential info, trim elaboration
    return message.split(". ").slice(0, 2).join(". ")
  }

  return message
}

/**
 * Determine whether to show a suggestion based on tone config
 */
export function shouldShowSuggestion(
  suggestionComplexity: number, // 0-1
  timeSinceSuggestion: number, // milliseconds
  toneConfig: CompanionToneConfig,
): boolean {
  // Check complexity threshold
  if (suggestionComplexity < toneConfig.complexityThreshold) {
    return false
  }

  // Check frequency limit
  const minTimeBetweenSuggestions = (60 * 60 * 1000) / toneConfig.suggestionFrequency
  if (timeSinceSuggestion < minTimeBetweenSuggestions) {
    return false
  }

  // In minimal states, only show necessary suggestions
  if (toneConfig.initiativeLevel < 0.2) {
    return suggestionComplexity > 0.7 // only high-value suggestions
  }

  return true
}

/**
 * Generate encouragement message based on tone
 */
export function generateEncouragement(
  context: "progress" | "completion" | "recovery" | "consistency",
  toneConfig: CompanionToneConfig,
  trustScore: number, // 0-1, how well does system know user
): string {
  if (toneConfig.encouragementIntensity < 0.2) {
    return "" // no encouragement in minimal states
  }

  const intensity = toneConfig.encouragementIntensity

  if (context === "progress") {
    if (intensity > 0.8) return `You're making great progress! Keep this momentum.`
    if (intensity > 0.6) return `Good progress.`
    return `Continuing forward.`
  }

  if (context === "completion") {
    if (intensity > 0.8) return `Excellent work! You completed this well.`
    if (intensity > 0.6) return `Nice completion.`
    return `Done.`
  }

  if (context === "recovery") {
    if (intensity > 0.8) return `You're stabilizing well. Take your time.`
    if (intensity > 0.6) return `You're finding your rhythm.`
    return `Stabilizing.`
  }

  if (context === "consistency") {
    if (intensity > 0.8) return `You're building good habits. I'm learning how to help you better.`
    if (intensity > 0.6) return `Patterns are forming.`
    return `Consistency building.`
  }

  return ""
}

/**
 * Compute response delay to appear more thoughtful
 */
export function computeResponseDelay(
  toneConfig: CompanionToneConfig,
  messageLength: number, // character count
): number {
  // Base delay from config
  let delay = toneConfig.responseTime

  // Longer messages can take longer to "compose"
  const messageDelayBonus = (messageLength / 100) * 200
  delay += messageDelayBonus

  // Add jitter for natural feel (±10%)
  const jitter = delay * (Math.random() - 0.5) * 0.2

  return Math.max(100, delay + jitter) // min 100ms, max varies
}

/**
 * Determine initiative level for current context
 */
export function shouldInitiate(
  context: "suggestion" | "break_reminder" | "pattern_feedback" | "direction_confirmation",
  toneConfig: CompanionToneConfig,
  userEngagement: number, // 0-1
): boolean {
  // Never initiate if initiative is disabled
  if (toneConfig.initiativeLevel < 0.1) {
    return false
  }

  // Check based on context
  if (context === "suggestion") {
    return Math.random() < toneConfig.initiativeLevel
  }

  if (context === "break_reminder") {
    return Math.random() < toneConfig.initiativeLevel * 0.7 // less aggressive
  }

  if (context === "pattern_feedback") {
    return Math.random() < toneConfig.initiativeLevel * 0.5 // only occasionally
  }

  if (context === "direction_confirmation") {
    return toneConfig.initiativeLevel > 0.4 // only in engaged states
  }

  return false
}
