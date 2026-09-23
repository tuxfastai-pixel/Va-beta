import { buildCareerNarrative } from "./careerNarrativeEngine.ts"
import { parseConversationalCareerIntake } from "./conversationalCareerIntake.ts"
import { expandCapabilities } from "./capabilityExpansionEngine.ts"
import {
  parseInternationalPaymentReadinessFromAnswers,
  scoreInternationalPaymentReadiness,
} from "./internationalPaymentReadiness.ts"
import { scoreInternationalReadiness } from "./internationalReadiness.ts"
import { scoreRemoteSuitability } from "./remoteSuitabilityEngine.ts"
import { scoreSkillConfidence } from "./skillConfidenceEngine.ts"
import { resolveWorkPreferences } from "./workPreferenceEngine.ts"
import type { CareerIdentityProfile, CareerIntakeInput, NormalizedResume } from "./careerTypes.ts"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function inferHiddenSkills(normalized: NormalizedResume, conversationText: string): string[] {
  const text = `${normalized.cleanText} ${conversationText}`.toLowerCase()
  const hidden: string[] = []

  if (text.includes("helped") || text.includes("assist")) {
    hidden.push("operational support")
  }
  if (text.includes("community") || text.includes("volunteer")) {
    hidden.push("community leadership")
  }
  if (text.includes("teach") || text.includes("training")) {
    hidden.push("knowledge transfer")
  }
  if (text.includes("sales") || text.includes("customer")) {
    hidden.push("commercial communication")
  }

  return Array.from(new Set(hidden))
}

function estimateExperienceYears(text: string): number {
  const matches = Array.from(text.matchAll(/(\d{1,2})\+?\s*years?/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0)

  if (matches.length === 0) {
    return 1
  }

  return Math.max(...matches)
}

function resolveSeniorityTier(experienceYearsEstimate: number): "entry" | "mid" | "senior" {
  if (experienceYearsEstimate >= 8) {
    return "senior"
  }

  if (experienceYearsEstimate >= 3) {
    return "mid"
  }

  return "entry"
}

function buildIdentityLayer(text: string): {
  origin: string
  bridgePath: string[]
  targetTracks: string[]
  transitionDetected: boolean
} {
  const lower = text.toLowerCase()
  const transitionDetected =
    lower.includes("transition") ||
    lower.includes("switch") ||
    lower.includes("moving into") ||
    lower.includes("career change") ||
    lower.includes("relocating")

  const teacherSignals = ["teacher", "teaching", "classroom", "educator", "lesson"]
  const bankerSignals = ["bank", "banking", "credit", "finance", "compliance", "risk", "portfolio manager"]

  if (teacherSignals.some((signal) => lower.includes(signal))) {
    return {
      origin: "educator",
      bridgePath: ["Educator", "Trainer", "Coordinator", "Administrator", "Operations Support"],
      targetTracks: ["training coordinator", "administrative coordinator", "operations support"],
      transitionDetected,
    }
  }

  if (bankerSignals.some((signal) => lower.includes(signal))) {
    return {
      origin: "financial services professional",
      bridgePath: ["Financial Services Professional", "Operations", "Risk", "Compliance", "Customer Success"],
      targetTracks: ["operations specialist", "risk analyst", "compliance coordinator", "customer success manager"],
      transitionDetected,
    }
  }

  return {
    origin: "general professional",
    bridgePath: ["Professional", "Coordinator", "Administrator", "Operations Support"],
    targetTracks: ["operations assistant", "administrative support", "customer support"],
    transitionDetected,
  }
}

export function buildCareerIdentityProfile(input: {
  intake: CareerIntakeInput
  normalizedResume: NormalizedResume
}): CareerIdentityProfile {
  const conversationText = String(input.intake.conversationText || "")
  const combinedText = `${input.normalizedResume.cleanText} ${conversationText}`
  const intake = parseConversationalCareerIntake(conversationText)
  const paymentIntake = parseInternationalPaymentReadinessFromAnswers(input.intake.answers)
  const preferences = resolveWorkPreferences({
    conversationText,
    answers: input.intake.answers,
    preferences: input.intake.preferences,
  })

  const skillConfidence = scoreSkillConfidence(input.normalizedResume, conversationText)
  const hiddenSkills = inferHiddenSkills(input.normalizedResume, conversationText)
  const experienceYearsEstimate = estimateExperienceYears(combinedText)
  const seniorityTier = resolveSeniorityTier(experienceYearsEstimate)
  const identityLayer = buildIdentityLayer(combinedText)
  const capabilityExpansion = expandCapabilities([...input.normalizedResume.skillSignals, ...intake.skills, ...hiddenSkills])
  const capabilityRoles = capabilityExpansion.flatMap((item) => item.opportunities)
  const seniorityRoles = seniorityTier === "senior"
    ? ["operations manager", "program operations lead", "client success lead"]
    : seniorityTier === "entry"
      ? ["junior operations assistant", "entry-level coordinator"]
      : []
  const recommendedRoles = Array.from(
    new Set([...identityLayer.targetTracks, ...capabilityRoles, ...seniorityRoles]),
  ).slice(0, 10)
  const readiness = scoreInternationalReadiness({
    preferences,
    skillConfidence,
    resumeText: input.normalizedResume.cleanText,
    conversationText,
  })
  const paymentReadiness = scoreInternationalPaymentReadiness({
    existingAccounts: paymentIntake.existingAccounts,
    noneYet: paymentIntake.noneYet,
    accountHolderName: paymentIntake.accountHolderName,
    accountEmail: paymentIntake.accountEmail,
    preferredPayoutCurrency: paymentIntake.preferredPayoutCurrency,
    hasTaxInformation: paymentIntake.hasTaxInformation,
    hasInternationalBankingPreference: paymentIntake.hasInternationalBankingPreference,
  })
  const remoteSuitability = scoreRemoteSuitability({ preferences, skillConfidence })
  const profileConfidence = clamp01((input.normalizedResume.confidence + readiness.score + remoteSuitability) / 3)

  const summary = buildCareerNarrative({
    summary:
      intake.background ||
      input.normalizedResume.bulletPoints[0] ||
      "Early-career professional with transferable operational strengths.",
    skills: [...Object.keys(skillConfidence).filter((key) => (skillConfidence[key] ?? 0) > 0.55), ...hiddenSkills],
    goals: recommendedRoles,
  })

  return {
    userId: input.intake.userId ?? null,
    generatedAt: new Date().toISOString(),
    profileConfidence,
    internationalEmployabilityScore: readiness.score,
    internationalPaymentReadinessScore: paymentReadiness.score,
    overallReadiness: clamp01((profileConfidence + remoteSuitability + paymentReadiness.score / 100) / 3),
    experienceYearsEstimate,
    seniorityTier,
    identityLayer,
    resumeSummary: input.normalizedResume.bulletPoints.slice(0, 3).join(" "),
    summary,
    rawSkills: input.normalizedResume.skillSignals,
    translatedSkills: Object.keys(skillConfidence).filter((key) => (skillConfidence[key] ?? 0) > 0.55),
    hiddenSkills,
    recommendedRoles,
    workPreferences: preferences,
    pacingNotes: [
      preferences.pacingPreference === "slow"
        ? "Onboarding pace should remain low-pressure with approval pauses"
        : "Balanced pacing can be maintained with periodic trust checks",
    ],
    trustNotes: [
      "All application submissions require human approval",
      "Career profile changes should remain reversible",
      preferences.quietMode ? "Quiet mode preference detected" : "Standard notification pacing",
      paymentReadiness.score >= 75 ? "International payment setup is ready" : "International payment setup needs attention",
    ],
    skillConfidence,
    supportNeeds:
      profileConfidence < 0.5
        ? ["confidence reinforcement", "interview practice", "role translation support"]
        : ["targeted opportunity mapping", "tailored application prep"],
    sourceConfidence: input.normalizedResume.confidence,
  }
}
