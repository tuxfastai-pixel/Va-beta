import type { CareerReconstructionOutput } from "@/lib/career/careerTypes.ts"
import type { NormalizedJob } from "./jobNormalization.ts"

export function adaptResumeForJob(input: {
  job: NormalizedJob
  reconstruction: CareerReconstructionOutput
}): string {
  const titleLine = `Target role: ${input.job.title} at ${input.job.company}`
  const focusLine = `Role alignment: ${input.reconstruction.skillsMatrix
    .slice(0, 4)
    .map((item) => item.skill)
    .join(", ")}`

  return [titleLine, focusLine, input.reconstruction.atsCv].join("\n")
}
