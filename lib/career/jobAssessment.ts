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
  const keywordCandidates = lines
    .flatMap((line) => line.split(/[^a-zA-Z0-9+#.-]+/))
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 3)

  const uniqueKeywords = Array.from(new Set(keywordCandidates)).slice(0, 40)

  const skillPatterns: Array<[string, RegExp]> = [
    ["Microsoft Excel", /\bexcel\b/i],
    ["Power BI", /\bpower\s*bi\b/i],
    ["Python", /\bpython\b/i],
    ["CRM", /\bcrm\b|customer relationship management/i],
    ["Compliance", /\bcompliance\b/i],
    ["Data Analysis", /\bdata analys(?:is|tics)|analytical skills?\b/i],
    ["Customer Service", /\bcustomer (?:service|support|care|satisfaction)\b/i],
    ["Technical Support", /\btechnical support|help\s*desk|end[ -]?user support\b/i],
    ["Hardware Support", /\bhardware|equipment maintenance|device support\b/i],
    ["Software Support", /\bsoftware support|troubleshoot(?:ing)? software\b/i],
    ["Communication", /\bcommunication|communicat(?:e|ion)\b/i],
    ["Documentation", /\bdocumentation|document(?:ing)?\b/i],
    ["Reporting", /\breporting|prepare reports?\b/i],
    ["Project Management", /\bproject management|manage projects?\b/i],
    ["Microsoft Office", /\bmicrosoft office|ms office|word|powerpoint|outlook\b/i],
    ["Sales", /\bsales|selling\b/i],
    ["Cash Handling", /\bcash handling|cashier|till|point[ -]?of[ -]?sale|\bpos\b/i],
    ["Leadership", /\bleadership|team lead|supervis(?:e|ion)\b/i],
    ["Administration", /\badministrat(?:ion|ive)|office support\b/i],
    ["Problem Solving", /\bproblem[ -]?solving|resolve issues?|diagnos(?:e|is)\b/i],
  ]

  const preferredMarker = /preferred|advantage|nice to have|desirable|bonus/i
  const requirementMarker = /required|requirements|must|essential|proficien|experience (?:with|in)|skills?|responsibilit|duties|you will|role involves/i
  const sectionHeading = /^(?:benefits?|what we offer|compensation|salary|about (?:us|the company)|company|location|how to apply|application process)\s*:?$/i
  const requirementSectionHeading = /^(?:required (?:skills|qualifications)|requirements?|essential (?:skills|qualifications)|what you(?:'|’)ll need)\s*:?$/i
  const preferredSectionHeading = /^(?:preferred (?:skills|qualifications)|nice to have|desirable|bonus)\s*:?$/i

  let section: "required" | "preferred" | null = null
  const requiredLineValues: string[] = []
  const preferredLineValues: string[] = []

  for (const line of lines) {
    if (sectionHeading.test(line)) {
      section = null
      continue
    }
    if (preferredSectionHeading.test(line)) {
      section = "preferred"
      continue
    }
    if (requirementSectionHeading.test(line)) {
      section = "required"
      continue
    }

    if (preferredMarker.test(line)) {
      preferredLineValues.push(line)
      continue
    }
    if (section === "preferred") {
      preferredLineValues.push(line)
      continue
    }
    if (section === "required" || requirementMarker.test(line)) {
      requiredLineValues.push(line)
    }
  }

  const preferredLines = preferredLineValues.join("\n")
  const requirementLines = requiredLineValues.join("\n")

  const requirementText =
    requirementLines.trim().length > 0
      ? requirementLines
      : text

  const requiredSkills = skillPatterns
    .filter(([, pattern]) => pattern.test(requirementText))
    .map(([skill]) => skill)

  const preferredSkills = skillPatterns
    .filter(([, pattern]) => pattern.test(preferredLines))
    .map(([skill]) => skill)
    .filter((skill) => !requiredSkills.includes(skill))

  const tools = skillPatterns
    .filter(([skill, pattern]) =>
      /Excel|Power BI|Python|CRM|Microsoft Office/.test(skill) &&
      pattern.test(text)
    )
    .map(([skill]) => skill)

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
    evidenceText?: string[]
  }
}): {
  scores: AssessmentScores
  band: RecommendationBand
  riskFlags: ApplicationRiskFlag[]
  verifiedSkills: string[]
  transferableSkills: string[]
  missingSkills: string[]
} {
  const normalizeSkill = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

  const capabilityAliases: Record<string, RegExp> = {
    "Microsoft Excel": /\bexcel\b/i,
    "Power BI": /\bpower\s*bi\b/i,
    Python: /\bpython\b/i,
    CRM: /\bcrm\b|customer relationship management|salesforce|hubspot/i,
    Compliance: /\bcompliance\b|regulatory requirements?/i,
    "Data Analysis": /\bdata analys(?:is|tics)|analytical skills?\b/i,
    "Customer Service": /\bcustomer (?:service|support|care|satisfaction)|assist(?:ed|ing)? customers?|client support/i,
    "Technical Support": /\btechnical support|help\s*desk|end[ -]?user support|troubleshoot/i,
    "Hardware Support": /\bhardware|equipment maintenance|device support/i,
    "Software Support": /\bsoftware support|software troubleshooting/i,
    Communication: /\bcommunication|communicat(?:e|ion)|customer liaison|client liaison/i,
    Documentation: /\bdocumentation|document(?:ing|ed)?|record keeping/i,
    Reporting: /\breporting|prepare(?:d)? reports?|daily records?/i,
    "Project Management": /\bproject management|managed? projects?|project planning/i,
    "Microsoft Office": /\bmicrosoft office|ms office|word|powerpoint|outlook/i,
    Sales: /\bsales|selling|cashier|teller|till|point[ -]?of[ -]?sale|customer transactions?/i,
    "Cash Handling": /\bcash handling|cashier|teller|till|cash transactions?|daily takings|reconcil(?:e|ed|iation)/i,
    Leadership: /\bleadership|team lead|supervis(?:e|ed|ion)|managed? (?:a )?team/i,
    Administration: /\badministrat(?:ion|ive)|office support|record keeping/i,
    "Problem Solving": /\bproblem[ -]?solving|resolved? issues?|diagnos(?:e|is)|troubleshoot/i,
  }

  const directCorpus = input.profile.translatedSkills.join("\n")
  const evidenceCorpus = [
    ...input.profile.evidenceText || [],
    ...input.profile.hiddenSkills,
  ].join("\n")
  const required = input.parsedJob.requiredSkills

  const directMatch = (skill: string) => {
    const pattern = capabilityAliases[skill]
    return pattern
      ? pattern.test(directCorpus)
      : directCorpus.includes(normalizeSkill(skill))
  }

  const evidenceMatch = (skill: string) => {
    const pattern = capabilityAliases[skill]
    return pattern
      ? pattern.test(evidenceCorpus)
      : evidenceCorpus.includes(normalizeSkill(skill))
  }

  const verifiedSkills = required.filter(directMatch)
  const transferableSkills = required.filter(
    (skill) => !directMatch(skill) && evidenceMatch(skill)
  )
  const missingSkills = required.filter(
    (skill) => !directMatch(skill) && !evidenceMatch(skill)
  )

  const verifiedHits = verifiedSkills.length
  const transferableHits = transferableSkills.length

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
    verifiedSkills,
    transferableSkills,
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
