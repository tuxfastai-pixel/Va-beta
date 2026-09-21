export type StructuredCareerProfile =
  Record<string, unknown>

export type SkillReviewCandidate = {
  skill: string
  sourceEvidence: string
  requiresConfirmation: true
}

type SkillEvidenceRecord = {
  skill?: unknown
  evidence?: unknown
  requiresConfirmation?: unknown
}

function normalized(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) =>
          String(item || "").trim()
        )
        .filter(Boolean)
    : []
}

function evidenceRecords(
  value: unknown
): SkillEvidenceRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is SkillEvidenceRecord =>
          typeof item === "object" &&
          item !== null
      )
    : []
}

export function collectPendingSkillReviewCandidates(
  structured: StructuredCareerProfile
): SkillReviewCandidate[] {
  const confirmed = new Set(
    strings(structured.skills).map(normalized)
  )

  const seen = new Set<string>()
  const candidates: SkillReviewCandidate[] = []

  for (
    const item of evidenceRecords(
      structured.skillsNeedingConfirmation
    )
  ) {
    const skill =
      String(item.skill || "").trim()
    const sourceEvidence =
      String(item.evidence || "").trim()
    const key = normalized(skill)

    if (
      !skill ||
      !sourceEvidence ||
      confirmed.has(key) ||
      seen.has(key)
    ) {
      continue
    }

    seen.add(key)
    candidates.push({
      skill,
      sourceEvidence,
      requiresConfirmation: true,
    })
  }

  return candidates.slice(0, 20)
}

const arraySectionKeys:
  Record<string, string> = {
    work_experience: "workExperience",
    skills: "skills",
    education: "education",
    certifications: "certifications",
    projects: "projects",
    achievements: "achievements",
  }

export function applyApprovedCvChange(
  structured: StructuredCareerProfile,
  change: {
    section: string
    originalText: string
    proposedText: string
  }
): StructuredCareerProfile {
  const proposedText =
    change.proposedText.trim()

  if (!proposedText) {
    return structured
  }

  if (
    change.section ===
    "professional_summary"
  ) {
    return {
      ...structured,
      professionalSummary: proposedText,
    }
  }

  const key =
    arraySectionKeys[change.section]

  if (!key) {
    return structured
  }

  const current = strings(structured[key])
  const originalKey =
    normalized(change.originalText)
  const proposedKey =
    normalized(proposedText)
  let replaced = false

  const updated = current.map((item) => {
    if (
      !replaced &&
      normalized(item) === originalKey
    ) {
      replaced = true
      return proposedText
    }

    return item
  })

  if (
    !replaced &&
    change.section === "skills" &&
    !updated.some(
      (item) =>
        normalized(item) === proposedKey
    )
  ) {
    updated.push(proposedText)
  }

  const next:
    StructuredCareerProfile = {
      ...structured,
      [key]: Array.from(
        new Map(
          updated.map((item) => [
            normalized(item),
            item,
          ])
        ).values()
      ),
    }

  if (change.section === "skills") {
    next.skillsNeedingConfirmation =
      evidenceRecords(
        structured.skillsNeedingConfirmation
      ).filter(
        (item) =>
          normalized(
            String(item.skill || "")
          ) !== originalKey
      )

    next.skillEvidence =
      evidenceRecords(
        structured.skillEvidence
      ).map((item) =>
        normalized(
          String(item.skill || "")
        ) === originalKey
          ? {
              ...item,
              skill: proposedText,
              requiresConfirmation: false,
            }
          : item
      )
  }

  return next
}
