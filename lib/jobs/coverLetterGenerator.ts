import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"
import type { NormalizedJob } from "./jobNormalization.ts"

export function generateCoverLetter(input: {
  profile: CareerIdentityProfile
  job: NormalizedJob
  userName?: string | null
}): string {
  const greeting = "Dear Hiring Team,"
  const intro = `I am excited to apply for the ${input.job.title} role at ${input.job.company}.`
  const strengths = `My strengths include ${input.profile.translatedSkills.slice(0, 5).join(", ") || "cross-functional operations support"}.`
  const value = `I bring a trust-aware and continuity-focused working style with a readiness score of ${Math.round(
    input.profile.overallReadiness * 100,
  )}%.`
  const closing = `Thank you for considering my application.\n\nSincerely,\n${input.userName || "Candidate"}`

  return [greeting, "", intro, strengths, value, "", closing].join("\n")
}
