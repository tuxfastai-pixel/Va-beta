import type { CareerPreference } from "./careerTypes.ts"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

export function scoreRemoteSuitability(input: {
  preferences: CareerPreference
  skillConfidence: Record<string, number>
}): number {
  let score = 0.3

  if (input.preferences.remote) {
    score += 0.25
  }
  if (input.preferences.hybrid) {
    score += 0.1
  }
  if (input.preferences.international) {
    score += 0.1
  }
  score += (input.skillConfidence.remote ?? 0) * 0.1
  score += (input.skillConfidence.communication ?? 0) * 0.1
  score += (input.skillConfidence.digital ?? 0) * 0.1

  return clamp01(score)
}
