import type {
  SkillEvidence,
  SkillExtractionResult,
} from "@/lib/career/cvSkillExtraction"

export type CvInputMode = "upload" | "paste" | "build_from_onboarding" | "continue_without_cv"

export type StructuredCv = {
  fullName: string
  contactDetails: string[]
  professionalSummary: string
  education: string[]
  certifications: string[]
  workExperience: string[]
  projects: string[]
  skills: string[]
  skillEvidence: SkillEvidence[]
  skillsNeedingConfirmation: SkillEvidence[]
  skillExtractionMode: "deterministic" | "ai"
  softwareTools: string[]
  languages: string[]
  achievements: string[]
  interests: string[]
  preferredRoles: string[]
  remoteWorkReadiness: number
  internationalPaymentReadiness: number
  missingFields: string[]
  followUpQuestions: string[]
}

function extractSection(
  text: string,
  headings: string[],
  deduplicate = true
): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const lowerHeadings = headings.map((heading) => heading.toLowerCase())
  const collected: string[] = []
  let active = false

  for (const line of lines) {
    const lower = line.toLowerCase()
    const isHeading = lowerHeadings.some((heading) => lower.startsWith(heading))

    if (isHeading) {
      active = true
      continue
    }

    if (
      active &&
      /^(education|educational background|post matric|experience|work experience|employment history|career history|projects|skills|key skills|core skills|computer literacy|languages|certifications|achievements|interests|career aspirations|summary|professional summary|profile|preferred roles|target roles|contact|references)/i.test(lower)
    ) {
      active = false
    }

    if (active) {
      collected.push(line.replace(/^[-*ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢]\s*/, "").trim())
    }
  }

  const filtered =
    collected.filter(Boolean)

  return deduplicate
    ? Array.from(new Set(filtered))
    : filtered
}

function splitInlineList(text: string, regex: RegExp): string[] {
  const match = text.match(regex)
  if (!match?.[1]) {
    return []
  }

  return Array.from(
    new Set(
      match[1]
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function splitTopLevelList(value: string): string[] {
  const parts: string[] = []
  let current = ""
  let depth = 0

  for (const character of value) {
    if (character === "(" || character === "[") {
      depth += 1
    } else if (
      character === ")" ||
      character === "]"
    ) {
      depth = Math.max(0, depth - 1)
    }

    if (
      depth === 0 &&
      (
        character === "," ||
        character === ";" ||
        character === "|"
      )
    ) {
      if (current.trim()) {
        parts.push(current.trim())
      }
      current = ""
      continue
    }

    current += character
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

function normalizeSkillEntries(
  entries: string[]
): string[] {
  const proficiencyLegend =
    /\b(advanced|solid|subject matter|expert|sme|intermediate|basic)\b/i

  const expanded =
    entries.flatMap((entry) => {
      const colonIndex =
        entry.indexOf(":")

      const candidate =
        colonIndex > -1 &&
        proficiencyLegend.test(
          entry.slice(0, colonIndex)
        )
          ? entry.slice(colonIndex + 1)
          : entry

      return splitTopLevelList(candidate)
    })

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const item of expanded) {
    const cleaned =
      item.replace(/\s+/g, " ").trim()

    const key =
      cleaned.toLowerCase()

    const proficiencyOnly =
      /^(advanced|solid|subject matter(?: expert)?|expert|sme|intermediate|beginner|basic|good|excellent|fair|average)(?:\s*\(sme\))?$/i

    if (
      !cleaned ||
      proficiencyOnly.test(cleaned) ||
      seen.has(key)
    ) {
      continue
    }

    seen.add(key)
    normalized.push(cleaned)
  }

  return normalized
}

type WorkRecord = {
  company: string[]
  position: string[]
  responsibilities: string[]
  period: string[]
}

function groupWorkExperience(
  entries: string[]
): string[] {
  const labelPattern =
    /^(?:\d+[.)]\s*)?(company(?:\s+name)?|employer|position\s+held|position|job\s+title|responsibilit(?:y|ies)|duties|employment\s+period|employment\s+dates|period|duration|dates)\s*:?\s*(.*)$/i

  const hasStructuredLabels =
    entries.some((entry) =>
      labelPattern.test(entry)
    )

  if (!hasStructuredLabels) {
    return entries
  }

  const grouped: string[] = []

  const emptyRecord = (): WorkRecord => ({
    company: [],
    position: [],
    responsibilities: [],
    period: [],
  })

  let record = emptyRecord()
  let pending:
    keyof WorkRecord | null = null

  const hasValues = () =>
    Object.values(record).some(
      (values) => values.length > 0
    )

  const append = (
    key: keyof WorkRecord,
    value: string
  ) => {
    const cleaned =
      value.replace(/\s+/g, " ").trim()

    if (cleaned) {
      record[key].push(cleaned)
    }
  }

  const flush = () => {
    if (!hasValues()) {
      return
    }

    const lines = [
      record.company.length > 0
        ? `Company: ${record.company.join(" ")}`
        : "",
      record.position.length > 0
        ? `Position: ${record.position.join(" ")}`
        : "",
      record.responsibilities.length > 0
        ? `Responsibilities: ${record.responsibilities.join(" ")}`
        : "",
      record.period.length > 0
        ? `Employment period: ${record.period.join(" ")}`
        : "",
    ].filter(Boolean)

    if (lines.length > 0) {
      grouped.push(lines.join("\n"))
    }

    record = emptyRecord()
    pending = null
  }

  const fieldFor = (
    label: string
  ): keyof WorkRecord => {
    if (
      /company|employer/i.test(label)
    ) {
      return "company"
    }

    if (
      /position|job\s+title/i.test(label)
    ) {
      return "position"
    }

    if (
      /responsibilit|duties/i.test(label)
    ) {
      return "responsibilities"
    }

    return "period"
  }

  for (const entry of entries) {
    const cleaned =
      entry.replace(/\s+/g, " ").trim()

    if (!cleaned) {
      continue
    }

    if (
      /^(full[- ]?time|part[- ]?time)$/i.test(
        cleaned
      )
    ) {
      continue
    }

    const match =
      cleaned.match(labelPattern)

    if (match) {
      const field =
        fieldFor(match[1])

      if (
        (
          field === "company" &&
          hasValues()
        ) ||
        (
          field === "position" &&
          record.position.length > 0
        )
      ) {
        flush()
      }

      const inlineValue =
        String(match[2] || "").trim()

      if (inlineValue) {
        append(field, inlineValue)
        pending = null
      } else {
        pending = field
      }

      continue
    }

    if (pending) {
      append(pending, cleaned)
      pending = null
      continue
    }

    if (
      record.responsibilities.length > 0
    ) {
      append(
        "responsibilities",
        cleaned
      )
    } else if (
      record.position.length === 0
    ) {
      append("position", cleaned)
    } else {
      append(
        "responsibilities",
        cleaned
      )
    }
  }

  flush()

  return grouped
}

function targetedFollowUps(structured: StructuredCv) {
  const prompts: string[] = []

  if (!structured.professionalSummary) {
    prompts.push("Share a 2-3 sentence professional summary focused on your strongest outcomes.")
  }
  if (structured.workExperience.length === 0) {
    prompts.push("List your latest two roles and the impact you delivered in each.")
  }
  if (structured.skills.length < 4) {
    prompts.push("Add 5 core skills you can currently demonstrate in live work.")
  }
  if (structured.preferredRoles.length === 0) {
    prompts.push("Which roles are you targeting first in this activation cycle?")
  }
  if (structured.contactDetails.length === 0) {
    prompts.push("Provide your preferred contact details for applications.")
  }

  return prompts.slice(0, 5)
}

export function structureCvInput(input: {
  mode: CvInputMode
  rawText?: string
  onboardingFallback?: {
    name?: string
    email?: string
    selectedCareers?: string[]
    paymentReadiness?: number
    remoteReadiness?: number
  }
}): StructuredCv {
  const text = String(input.rawText || "").trim()
  const fallback = input.onboardingFallback || {}

  const identityLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => {
      const normalized = line.replace(/^curriculum vitae(?:\s+of)?\s*/i, "").trim()
      return (
        normalized.split(/\s+/).length >= 2 &&
        /^[A-Za-z][A-Za-z' -]+$/.test(normalized)
      )
    })

  const fullName =
    identityLine?.replace(/^curriculum vitae(?:\s+of)?\s*/i, "").trim() ||
    fallback.name ||
    ""
  const contactDetails = Array.from(
    new Set([
      ...splitInlineList(text, /contact\s*[:\-]\s*(.+)/i),
      ...splitInlineList(text, /email\s*[:\-]\s*(.+)/i),
      fallback.email || "",
    ].filter(Boolean)),
  )

  const professionalSummary = extractSection(text, [
    "professional summary",
    "summary",
    "profile",
    "career aspirations",
  ]).join(" ")
  const education = extractSection(text, [
    "education",
    "educational background",
    "academic background",
    "post matric qualifications",
  ])
  const certifications = extractSection(text, [
    "certifications",
    "certification",
    "licenses",
    "post matric qualifications",
  ])
  const workExperience = groupWorkExperience(
    extractSection(
      text,
      [
        "experience",
        "work experience",
        "employment history",
        "career history",
      ],
      false
    )
  )
  const projects = extractSection(text, ["projects", "project experience"])
  const skills = normalizeSkillEntries([
    ...extractSection(text, [
      "skills",
      "key skills",
      "core skills",
      "computer literacy",
      "technical skills",
    ]),
    ...splitInlineList(
      text,
      /skills\s*[:\-]\s*(.+)/i
    ),
    ...(fallback.selectedCareers || []),
  ])
  const softwareTools = extractSection(text, ["software", "tools", "tech stack"])
  const languages = extractSection(text, ["languages", "language proficiency"])
  const achievements = extractSection(text, ["achievements", "accomplishments"])
  const interests = extractSection(text, ["interests", "hobbies"])
  const preferredRoles = extractSection(text, ["preferred roles", "target roles"]).concat(fallback.selectedCareers || [])

  const remoteWorkReadiness = Math.max(0, Math.min(100, Number(fallback.remoteReadiness || (workExperience.length > 0 ? 70 : 45))))
  const internationalPaymentReadiness = Math.max(0, Math.min(100, Number(fallback.paymentReadiness || 50)))

  const missingFields = [
    fullName ? null : "full_name",
    professionalSummary ? null : "professional_summary",
    workExperience.length > 0 ? null : "work_experience",
    skills.length > 0 ? null : "skills",
    preferredRoles.length > 0 ? null : "preferred_roles",
  ].filter((item): item is string => Boolean(item))

  const structured: StructuredCv = {
    fullName,
    contactDetails,
    professionalSummary,
    education,
    certifications,
    workExperience,
    projects,
    skills,
    skillEvidence: [],
    skillsNeedingConfirmation: [],
    skillExtractionMode: "deterministic",
    softwareTools,
    languages,
    achievements,
    interests,
    preferredRoles: Array.from(new Set(preferredRoles.filter(Boolean))),
    remoteWorkReadiness,
    internationalPaymentReadiness,
    missingFields,
    followUpQuestions: [],
  }

  structured.followUpQuestions = targetedFollowUps(structured)
  return structured
}

export function mergeSkillExtraction(
  structured: StructuredCv,
  extraction: SkillExtractionResult
): StructuredCv {
  const combinedSkills =
    normalizeSkillEntries([
      ...structured.skills,
      ...extraction.confirmedSkills,
    ])

  const next: StructuredCv = {
    ...structured,
    skills: combinedSkills,
    skillEvidence: extraction.evidence,
    skillsNeedingConfirmation:
      extraction.pendingSkills,
    skillExtractionMode: extraction.mode,
    missingFields:
      combinedSkills.length > 0
        ? structured.missingFields.filter(
            (field) => field !== "skills"
          )
        : Array.from(
            new Set([
              ...structured.missingFields,
              "skills",
            ])
          ),
    followUpQuestions: [],
  }

  next.followUpQuestions =
    targetedFollowUps(next)

  return next
}

export function buildCvFromOnboardingAnswers(input: {
  name: string
  email: string
  selectedCareers: string[]
  skillTrack: string
  summary?: string
}) {
  const roles = input.selectedCareers.length > 0 ? input.selectedCareers : [input.skillTrack]

  return [
    input.name,
    `Email: ${input.email}`,
    "Professional Summary",
    input.summary || `Career activation profile focused on ${roles.join(", ")}.`,
    "Skills",
    ...roles.map((role) => `- ${role}`),
    "Preferred Roles",
    ...roles.map((role) => `- ${role}`),
  ].join("\n")
}