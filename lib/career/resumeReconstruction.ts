import type { CareerIdentityProfile, CareerReconstructionOutput, NormalizedResume } from "./careerTypes.ts"
import { optimizeForAts } from "./atsOptimization.ts"
import { buildCareerNarrative } from "./careerNarrativeEngine.ts"
import { buildRemotePositioningSummary } from "./remoteWorkPositioning.ts"
import { translateBullets } from "./professionalLanguageTranslator.ts"

function matrixFromSkills(skills: string[], confidence: Record<string, number>) {
  return skills.slice(0, 10).map((skill) => ({
    skill,
    evidence: Number(confidence[skill] ?? 0.5),
    roleFit: Number(Math.max(0.35, confidence[skill] ?? 0.5)),
  }))
}

export function reconstructResumeProfile(input: {
  profile: CareerIdentityProfile
  normalizedResume: NormalizedResume
}): CareerReconstructionOutput {
  const translatedBullets = translateBullets(input.normalizedResume.bulletPoints)
  const atsLines = optimizeForAts(translatedBullets)
  const shortBio = buildCareerNarrative({
    summary: input.profile.summary,
    skills: input.profile.translatedSkills,
    goals: input.profile.recommendedRoles,
  })

  const linkedinSummary = `${shortBio} Focused on ${input.profile.recommendedRoles.slice(0, 3).join(", ")}.`

  const remoteSummary = buildRemotePositioningSummary({
    skills: input.profile.translatedSkills,
    confidence: input.profile.profileConfidence,
    timezoneFlexibility: input.profile.workPreferences.timezoneFlexibility,
  })

  return {
    atsCv: atsLines.join("\n"),
    remoteReadyCv: [remoteSummary, ...atsLines].join("\n"),
    shortBio,
    linkedinSummary,
    skillsMatrix: matrixFromSkills(input.profile.translatedSkills, input.profile.skillConfidence),
    internationalEmployabilityScore: input.profile.internationalEmployabilityScore,
    confidenceProfile:
      input.profile.profileConfidence < 0.5
        ? "Developing confidence profile: guided applications and interview rehearsal recommended."
        : "Stable confidence profile: ready for guided international and remote applications.",
  }
}
