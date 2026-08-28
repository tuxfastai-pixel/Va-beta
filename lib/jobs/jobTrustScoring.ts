import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"
import type { NormalizedJob } from "./jobNormalization.ts"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

export function scoreJobTrust(job: NormalizedJob, profile: CareerIdentityProfile): {
  trustScore: number
  reasons: string[]
} {
  const reasons: string[] = []
  let trustScore = 0.35

  if (job.remote && profile.workPreferences.remote) {
    trustScore += 0.18
    reasons.push("Remote preference aligned")
  }

  if (profile.workPreferences.international && job.location.toLowerCase().includes("global")) {
    trustScore += 0.12
    reasons.push("International readiness aligned")
  }

  if (profile.workPreferences.pacingPreference === "slow") {
    trustScore -= 0.04
    reasons.push("Slow pacing preference requires controlled apply cadence")
  }

  if (profile.workPreferences.quietMode) {
    trustScore += 0.03
    reasons.push("Quiet mode enabled for notification safety")
  }

  trustScore += profile.profileConfidence * 0.22
  trustScore += profile.internationalEmployabilityScore * 0.16

  return {
    trustScore: clamp01(trustScore),
    reasons,
  }
}
