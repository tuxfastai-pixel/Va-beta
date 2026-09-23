import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"
import type { NormalizedJob } from "./jobNormalization.ts"

export function buildInterviewPreparation(input: {
  profile: CareerIdentityProfile
  job: NormalizedJob
}) {
  const seniority = input.profile.seniorityTier || "entry"
  const transitionDetected = Boolean(input.profile.identityLayer?.transitionDetected)
  const roleKeywords = input.job.description
    .split(/[^a-zA-Z]+/)
    .map((token) => token.toLowerCase().trim())
    .filter((token) => token.length > 4)
    .slice(0, 10)

  const rehearsalQuestions = [
      `Why do you want to work as a ${input.job.title}?`,
      "Tell us about a time you solved a difficult problem.",
      "How do you manage your workload across changing priorities?",
    ]

  if (seniority === "senior") {
    rehearsalQuestions.push("How have you led teams or stakeholders through ambiguity and change?")
  } else if (seniority === "entry") {
    rehearsalQuestions.push("Tell us about a project where you learned quickly and delivered value.")
  }

  if (transitionDetected) {
    rehearsalQuestions.push("How do your transferable skills from your previous field map to this role?")
  }

  return {
    rehearsalQuestions,
    preparationReminders: [
      "Use STAR structure for experience examples",
      "Keep answers concise and evidence-based",
      "Prepare one continuity/recovery example",
      transitionDetected ? "Prepare one direct transferable-skills story" : "Prepare one role-specific impact story",
    ],
    stressPacingTips: [
      "Pause before answering and structure response in 3 points",
      "Breathe for 4 seconds before high-pressure questions",
      "Request clarification when prompts feel ambiguous",
    ],
    roleKeywordFocus: roleKeywords,
    timezoneCoordinationHint:
      input.profile.workPreferences.timezoneFlexibility === "global"
        ? "Confirm interview availability across global timezones"
        : "Confirm timezone overlap in advance",
  }
}
