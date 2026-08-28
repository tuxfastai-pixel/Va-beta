import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"
import type { NormalizedJob } from "./jobNormalization.ts"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

export function scoreApplicationSuitability(job: NormalizedJob, profile: CareerIdentityProfile): {
  fit: number
  burnoutRisk: number
  interviewProbability: number
} {
  const roleText = `${job.title} ${job.description}`.toLowerCase()
  const skillOverlap = profile.translatedSkills.filter((skill) => roleText.includes(skill.split(" ")[0])).length

  const fit = clamp01(0.3 + skillOverlap * 0.1 + profile.profileConfidence * 0.35)
  const burnoutRisk = clamp01(
    (profile.workPreferences.pacingPreference === "slow" ? 0.3 : 0.15) +
      (profile.workPreferences.quietMode ? 0.15 : 0.05) +
      (job.remote ? 0.05 : 0.15),
  )
  const interviewProbability = clamp01(0.25 + fit * 0.45 + profile.internationalEmployabilityScore * 0.2 - burnoutRisk * 0.1)

  return {
    fit,
    burnoutRisk,
    interviewProbability,
  }
}
