import type { CareerIdentityProfile, CareerReconstructionOutput } from "@/lib/career/careerTypes.ts"
import type { NormalizedJob } from "./jobNormalization.ts"
import { adaptResumeForJob } from "./jobSpecificResumeAdapter.ts"
import { generateCoverLetter } from "./coverLetterGenerator.ts"
import { buildInterviewPreparation } from "./interviewPreparationEngine.ts"

export function prepareApplicationArtifacts(input: {
  profile: CareerIdentityProfile
  reconstruction: CareerReconstructionOutput
  job: NormalizedJob
  userName?: string | null
}) {
  const tailoredCv = adaptResumeForJob({
    job: input.job,
    reconstruction: input.reconstruction,
  })

  const tailoredSummary = `${input.profile.summary}\nRole target: ${input.job.title}`
  const coverLetter = generateCoverLetter({
    profile: input.profile,
    job: input.job,
    userName: input.userName,
  })

  const interviewPreparation = buildInterviewPreparation({
    profile: input.profile,
    job: input.job,
  })

  const skillGapAnalysis = input.reconstruction.skillsMatrix
    .filter((item) => item.evidence < 0.6)
    .slice(0, 5)
    .map((item) => `${item.skill}: strengthen evidence through examples and measurable outcomes`)

  return {
    tailoredCv,
    tailoredSummary,
    coverLetter,
    interviewPreparation,
    skillGapAnalysis,
    confidenceEstimate: Number(Math.max(0.2, input.profile.profileConfidence * 0.9).toFixed(2)),
    approvalActions: ["ACCEPT", "SKIP", "SAVE_FOR_LATER", "TRAIN_ME_FIRST"] as const,
  }
}
