import { resolveRecommendationBand, type RecommendationBand, type SkillState } from "@/lib/career/activationContinuity.ts"

export type ParsedJob = {
  title: string
  description: string
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: string
  qualifications: string[]
  tools: string[]
  responsibilities: string[]
  keywords: string[]
  salaryCurrency: string | null
  location: string | null
  remoteRequirement: string | null
  timezone: string | null
  payoutMethod: string | null
  applicationDeadline: string | null
}

export type AssessmentScores = {
  matchScore: number
  verifiedSkillScore: number
  transferableSkillScore: number
  missingSkillScore: number
  interviewReadinessScore: number
  paymentReadinessScore: number
}

export type ApplicationRiskFlag = {
  code: string
  severity: "low" | "medium" | "high"
  message: string
}

export type LearningSprintItem = {
  missingSkill: string
  whyItMatters: string
  estimatedLearningTime: string
  learningResources: string[]
  practicalExercise: string
  miniAssessment: string
  evidenceTask: string
  interviewExplanation: string
  completionStatus: SkillState
}

export function parseJobDescription(input: { title?: string; description: string; location?: string; salary?: string }): ParsedJob {
  const text = String(input.description || "")
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const normalized = text.toLowerCase()

  const keywordCandidates = lines
    .flatMap((line) => line.split(/[^a-zA-Z0-9+#.-]+/))
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 3)

  const uniqueKeywords = Array.from(new Set(keywordCandidates)).slice(0, 40)

  const requiredSkills = uniqueKeywords.filter((token) => ["excel", "powerbi", "python", "crm", "compliance", "analysis", "customer", "support", "interview"].includes(token))
  const preferredSkills = uniqueKeywords.filter((token) => ["automation", "documentation", "leadership", "communication", "reporting"].includes(token))
  const tools = uniqueKeywords.filter((token) => ["excel", "powerbi", "salesforce", "hubspot", "notion", "figma", "slack", "zendesk"].includes(token))

  return {
    title: String(input.title || lines[0] || "Untitled role").trim(),
    description: text,
    requiredSkills,
    preferredSkills,
    experienceLevel: /senior|lead|manager/i.test(text) ? "senior" : /mid/i.test(text) ? "mid" : "entry",
    qualifications: lines.filter((line) => /degree|diploma|certification|certified/i.test(line)).slice(0, 8),
    tools,
    responsibilities: lines.filter((line) => /responsib|you will|deliver|manage|own/i.test(line)).slice(0, 12),
    keywords: uniqueKeywords,
    salaryCurrency: /\b(usd|zar|eur|gbp|cad|aud)\b/i.exec(text)?.[1]?.toUpperCase() || null,
    location: input.location || (/remote|hybrid|onsite/i.exec(text)?.[0] || null),
    remoteRequirement: /fully remote|remote|hybrid|onsite/i.exec(text)?.[0] || null,
    timezone: /gmt|utc|est|sast|cet|pst/i.exec(text)?.[0]?.toUpperCase() || null,
    payoutMethod: /wise|payoneer|paypal|bank transfer|deel/i.exec(text)?.[0] || null,
    applicationDeadline: /deadline[:\s]+([^\n]+)/i.exec(text)?.[1]?.trim() || null,
  }
}

function pct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function assessJobFit(input: {
  parsedJob: ParsedJob
  profile: {
    translatedSkills: string[]
    hiddenSkills: string[]
    profileConfidence: number
    internationalPaymentReadinessScore: number
  }
}): {
  scores: AssessmentScores
  band: RecommendationBand
  riskFlags: ApplicationRiskFlag[]
  missingSkills: string[]
} {
  const verified = new Set(input.profile.translatedSkills.map((skill) => skill.toLowerCase()))
  const transferable = new Set(input.profile.hiddenSkills.map((skill) => skill.toLowerCase()))
  const required = input.parsedJob.requiredSkills

  const verifiedHits = required.filter((skill) => verified.has(skill.toLowerCase())).length
  const transferableHits = required.filter((skill) => transferable.has(skill.toLowerCase()) && !verified.has(skill.toLowerCase())).length
  const missingSkills = required.filter((skill) => !verified.has(skill.toLowerCase()) && !transferable.has(skill.toLowerCase()))

  const verifiedSkillScore = pct((verifiedHits / Math.max(1, required.length)) * 100)
  const transferableSkillScore = pct((transferableHits / Math.max(1, required.length)) * 100)
  const missingSkillScore = pct((missingSkills.length / Math.max(1, required.length)) * 100)
  const interviewReadinessScore = pct(input.profile.profileConfidence * 100)
  const paymentReadinessScore = pct(input.profile.internationalPaymentReadinessScore)

  const matchScore = pct(
    verifiedSkillScore * 0.35 +
      transferableSkillScore * 0.2 +
      (100 - missingSkillScore) * 0.2 +
      interviewReadinessScore * 0.15 +
      paymentReadinessScore * 0.1,
  )

  const riskFlags: ApplicationRiskFlag[] = []
  if (missingSkillScore >= 45) {
    riskFlags.push({ code: "high_missing_skills", severity: "high", message: "Critical required skills are currently missing." })
  }
  if (paymentReadinessScore < 55) {
    riskFlags.push({ code: "payment_readiness_low", severity: "medium", message: "Payment readiness setup may block international payout." })
  }
  if (interviewReadinessScore < 60) {
    riskFlags.push({ code: "interview_risk", severity: "medium", message: "Interview readiness is below safe threshold." })
  }

  return {
    scores: {
      matchScore,
      verifiedSkillScore,
      transferableSkillScore,
      missingSkillScore,
      interviewReadinessScore,
      paymentReadinessScore,
    },
    band: resolveRecommendationBand(matchScore),
    riskFlags,
    missingSkills,
  }
}

export function buildLearningSprint(input: { missingSkills: string[]; roleTitle: string }): LearningSprintItem[] {
  return input.missingSkills.slice(0, 3).map((skill) => ({
    missingSkill: skill,
    whyItMatters: `${skill} appears in role expectations for ${input.roleTitle}.`,
    estimatedLearningTime: "3-6 hours",
    learningResources: [
      `Official ${skill} documentation`,
      `${skill} guided fundamentals course`,
      `${skill} practical challenge walkthrough`,
    ],
    practicalExercise: `Build one realistic mini-deliverable using ${skill}.`,
    miniAssessment: `Complete a short practical quiz and explain decisions in plain language.`,
    evidenceTask: `Upload evidence artifact showing ${skill} usage in context.`,
    interviewExplanation: `Prepare a 60-second explanation of how you used ${skill} in your exercise.`,
    completionStatus: "Missing",
  }))
}

export function mapAiCapabilityByTask(responsibilities: string[]) {
  return responsibilities.map((task) => {
    const lower = task.toLowerCase()

    if (/regulated|compliance|legal approval|medical|financial advice/.test(lower)) {
      return {
        task,
        capability: "regulated/restricted",
        details: "Human execution with compliance oversight is required.",
      }
    }

    if (/interview|stakeholder meeting|negotiation|client call/.test(lower)) {
      return {
        task,
        capability: "human must perform",
        details: "AI can prepare scripts and notes, but live execution stays human.",
      }
    }

    if (/draft|document|report|summary|research|analysis/.test(lower)) {
      return {
        task,
        capability: "AI can fully assist",
        details: "AI can draft first-pass outputs; human approval still required before submission.",
      }
    }

    return {
      task,
      capability: "AI can partially assist",
      details: "AI can support preparation, while execution and verification remain human-led.",
    }
  })
}