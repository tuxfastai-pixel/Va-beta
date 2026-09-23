export type SkillEvidenceLike = {
  skill?: unknown
  evidence?: unknown
  sourceSection?: unknown
  confidence?: unknown
  requiresConfirmation?: unknown
}

export type CuratableProfile = Record<string, unknown>

export type SkillCategory =
  | "Product and AI"
  | "Technical tools"
  | "Service and support"
  | "Evidence and governance"
  | "Career operations"
  | "Transferable capabilities"

const CATEGORY_ORDER: SkillCategory[] = [
  "Product and AI",
  "Technical tools",
  "Service and support",
  "Evidence and governance",
  "Career operations",
  "Transferable capabilities",
]

const noiseSkillPattern =
  /^(?:capabilit(?:y|ies)|demonstrated knowledge(?: and experience)?|knowledge and experience|software and platform exposure|skills?|key skills|core skills|technical skills|professional competencies|core competencies)$/i

export function normalizeCareerTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean)
    : []
}

function evidence(value: unknown): SkillEvidenceLike[] {
  return Array.isArray(value)
    ? value.filter((item): item is SkillEvidenceLike => typeof item === "object" && item !== null)
    : []
}

export function isMarketableSkill(value: unknown): boolean {
  const skill = String(value || "").replace(/\s+/g, " ").trim()
  return Boolean(
    skill &&
    skill.length >= 2 &&
    skill.length <= 80 &&
    !noiseSkillPattern.test(skill) &&
    !/[•\n]/.test(skill)
  )
}

export function classifySkill(skill: string): SkillCategory {
  const key = normalizeCareerTerm(skill)

  if (/\b(ai|artificial intelligence|product|roadmap|requirements?|user journey|acceptance criteria|prompt|automation|human in the loop)\b/.test(key)) {
    return "Product and AI"
  }
  if (/\b(next\.?js|react|typescript|javascript|api|supabase|postgres|sql|git|github|vercel|ci\/cd|authentication|browser testing|deployment|hardware|software|networking|computer)\b/.test(key)) {
    return "Technical tools"
  }
  if (/\b(technical support|help desk|service desk|end user|customer service|equipment|fault diagnosis|maintenance|teller|cash|support)\b/.test(key)) {
    return "Service and support"
  }
  if (/\b(evidence|governance|chronology|source verification|document|record|issue tracking|compliance|audit)\b/.test(key)) {
    return "Evidence and governance"
  }
  if (/\b(career|cv|skills extraction|job matching|application|employability|remote work|interview)\b/.test(key)) {
    return "Career operations"
  }
  return "Transferable capabilities"
}

export function curateSkillGroups(
  profile: CuratableProfile,
  limit = 30
): Array<{ category: SkillCategory; skills: string[] }> {
  const confidenceBySkill = new Map<string, number>()
  for (const item of evidence(profile.skillEvidence)) {
    const key = normalizeCareerTerm(String(item.skill || ""))
    const score = Number(item.confidence)
    if (key && Number.isFinite(score)) {
      confidenceBySkill.set(key, Math.max(confidenceBySkill.get(key) || 0, score))
    }
  }

  const seen = new Set<string>()
  const ranked = strings(profile.skills)
    .filter(isMarketableSkill)
    .filter((skill) => {
      const key = normalizeCareerTerm(skill)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((skill, index) => ({
      skill,
      category: classifySkill(skill),
      confidence: confidenceBySkill.get(normalizeCareerTerm(skill)) ?? 0.8,
      index,
    }))
    .sort((left, right) =>
      right.confidence - left.confidence ||
      CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category) ||
      left.index - right.index
    )
    .slice(0, Math.max(1, limit))

  return CATEGORY_ORDER
    .map((category) => ({
      category,
      skills: ranked.filter((item) => item.category === category).map((item) => item.skill),
    }))
    .filter((group) => group.skills.length > 0)
}

export function summarizeExperience(profile: CuratableProfile): {
  roleCount: number | null
  evidenceCount: number
} {
  const entries = strings(profile.workExperience)
  const structuredRoles = entries.filter((entry) =>
    /(?:^|\n)(?:company|employer|position|job title)\s*:/i.test(entry)
  )

  return {
    roleCount: structuredRoles.length > 0 ? structuredRoles.length : null,
    evidenceCount: entries.length,
  }
}

export function applySkillCandidateDecision(
  profile: CuratableProfile,
  input: {
    skill: string
    decision: "confirm" | "reject"
    editedSkill?: string
  }
): CuratableProfile {
  const requestedKey = normalizeCareerTerm(input.skill)
  const pending = evidence(profile.skillsNeedingConfirmation)
  const candidate = pending.find((item) =>
    normalizeCareerTerm(String(item.skill || "")) === requestedKey
  )

  if (!candidate) {
    throw new Error("Skill candidate was not found")
  }

  const nextPending = pending.filter((item) =>
    normalizeCareerTerm(String(item.skill || "")) !== requestedKey
  )
  const currentSkills = strings(profile.skills)
  const rejected = strings(profile.rejectedSkillCandidates)

  if (input.decision === "reject") {
    return {
      ...profile,
      skillsNeedingConfirmation: nextPending,
      rejectedSkillCandidates: Array.from(new Set([...rejected, String(candidate.skill || input.skill)])),
    }
  }

  const promoted = String(input.editedSkill || candidate.skill || "")
    .replace(/\s+/g, " ")
    .trim()

  if (!isMarketableSkill(promoted)) {
    throw new Error("Enter a specific professional skill between 2 and 80 characters")
  }

  const promotedKey = normalizeCareerTerm(promoted)
  const nextSkills = Array.from(
    new Map(
      [...currentSkills, promoted]
        .filter(isMarketableSkill)
        .map((skill) => [normalizeCareerTerm(skill), skill])
    ).values()
  )

  return {
    ...profile,
    skills: nextSkills,
    skillsNeedingConfirmation: nextPending,
    skillEvidence: evidence(profile.skillEvidence).map((item) =>
      normalizeCareerTerm(String(item.skill || "")) === requestedKey
        ? { ...item, skill: promoted, requiresConfirmation: false }
        : item
    ),
    rejectedSkillCandidates: rejected.filter((skill) =>
      normalizeCareerTerm(skill) !== promotedKey
    ),
  }
}

export function applyProfileDetails(
  profile: CuratableProfile,
  input: {
    professionalSummary?: string
    preferredRoles?: string[]
  }
): CuratableProfile {
  const summary = String(input.professionalSummary || "").replace(/\s+/g, " ").trim()
  const roles = Array.from(
    new Map(
      (input.preferredRoles || [])
        .map((role) => String(role || "").replace(/\s+/g, " ").trim())
        .filter((role) => role.length >= 2 && role.length <= 80)
        .slice(0, 8)
        .map((role) => [normalizeCareerTerm(role), role])
    ).values()
  )

  if (summary && (summary.length < 30 || summary.length > 800)) {
    throw new Error("Professional summary must be between 30 and 800 characters")
  }

  const next = {
    ...profile,
    professionalSummary: summary || String(profile.professionalSummary || ""),
    preferredRoles: roles.length > 0 ? roles : strings(profile.preferredRoles),
  }

  const missingFields = strings(profile.missingFields).filter((field) => {
    if (field === "professional_summary" && next.professionalSummary) return false
    if (field === "preferred_roles" && strings(next.preferredRoles).length > 0) return false
    return true
  })

  const followUpQuestions = strings(profile.followUpQuestions).filter((question) => {
    if (/professional summary/i.test(question) && next.professionalSummary) return false
    if (/roles are you targeting/i.test(question) && strings(next.preferredRoles).length > 0) return false
    return true
  })

  return { ...next, missingFields, followUpQuestions }
}
