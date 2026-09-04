import { scoreApplicationSuitability } from "./applicationSuitability.ts"
import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"
import type { NormalizedJob } from "./jobNormalization.ts"

export function estimateInterviewProbability(job: NormalizedJob, profile: CareerIdentityProfile): number {
  return scoreApplicationSuitability(job, profile).interviewProbability
}
