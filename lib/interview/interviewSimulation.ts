import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"

export function runInterviewSimulation(input: {
  profile: CareerIdentityProfile
  role: string
}) {
  const baseline = Math.max(0.25, Math.min(0.95, input.profile.profileConfidence))

  return {
    role: input.role,
    confidenceBefore: Number((baseline * 0.92).toFixed(2)),
    confidenceAfter: Number(Math.min(0.99, baseline + 0.08).toFixed(2)),
    stressSignals: ["pace-spike", "long-pause"],
    coachingSummary: "Candidate benefits from structured answers and slower pacing in technical prompts.",
    nextDrills: [
      "Two-minute role intro",
      "Behavioral STAR drill",
      "Handling uncertainty question drill",
    ],
  }
}
