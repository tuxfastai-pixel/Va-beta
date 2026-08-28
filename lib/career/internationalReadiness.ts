import type { CareerPreference } from "./careerTypes.ts"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

export function scoreInternationalReadiness(input: {
  preferences: CareerPreference
  skillConfidence: Record<string, number>
  resumeText: string
  conversationText?: string | null
}): {
  score: number
  notes: string[]
} {
  const text = `${input.resumeText} ${input.conversationText || ""}`.toLowerCase()
  const notes: string[] = []

  let score = 0.35
  if (input.preferences.remote) {
    score += 0.18
    notes.push("Remote preference supports distributed opportunities")
  }
  if (input.preferences.international) {
    score += 0.18
    notes.push("International intent is explicit")
  }
  if (input.preferences.timezoneFlexibility === "global") {
    score += 0.12
    notes.push("Global timezone flexibility improves international fit")
  }
  if ((input.skillConfidence.communication ?? 0) > 0.6) {
    score += 0.08
    notes.push("Communication confidence is strong")
  }
  if ((input.skillConfidence.digital ?? 0) > 0.5 || text.includes("computer") || text.includes("excel")) {
    score += 0.1
    notes.push("Digital literacy signals are present")
  }
  if (text.includes("english") || text.includes("language")) {
    score += 0.05
  }
  if (!input.preferences.quietMode) {
    score += 0.02
  }

  return {
    score: clamp01(score),
    notes,
  }
}
