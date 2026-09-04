import {
  executeModelRequest,
  extractTextFromCompletion,
} from "../ai/executeModelRequest.ts"

export type SkillEvidenceType =
  | "explicit"
  | "inferred"

export type SkillEvidence = {
  skill: string
  evidence: string
  sourceSection: string
  evidenceType: SkillEvidenceType
  confidence: number
  requiresConfirmation: boolean
}

export type SkillExtractionResult = {
  confirmedSkills: string[]
  evidence: SkillEvidence[]
  pendingSkills: SkillEvidence[]
  mode: "ai"
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  )
}

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function extractJson(text: string): unknown {
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  return JSON.parse(unfenced)
}

const proficiencyOnly =
  /^(advanced|solid|subject matter(?: expert)?|expert|sme|intermediate|beginner|basic|good|excellent|fair|average)$/i

function safeSkillName(value: unknown) {
  const skill =
    typeof value === "string"
      ? value.replace(/\s+/g, " ").trim()
      : ""

  if (
    !skill ||
    skill.length < 2 ||
    skill.length > 80 ||
    proficiencyOnly.test(skill)
  ) {
    return ""
  }

  return skill
}

export function validateSkillExtractionPayload(
  payload: unknown,
  sourceText: string
): SkillEvidence[] {
  if (!isRecord(payload)) {
    return []
  }

  const candidates =
    Array.isArray(payload.skills)
      ? payload.skills
      : []

  const source = normalized(sourceText)
  const accepted: SkillEvidence[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue
    }

    const skill =
      safeSkillName(candidate.skill)

    const evidence =
      typeof candidate.evidence === "string"
        ? candidate.evidence
            .replace(/\s+/g, " ")
            .trim()
        : ""

    const sourceSection =
      typeof candidate.sourceSection === "string"
        ? candidate.sourceSection
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80)
        : "CV evidence"

    const requestedType =
      candidate.evidenceType === "explicit"
        ? "explicit"
        : "inferred"

    const requestedConfidence =
      Number(candidate.confidence)

    const confidence =
      Number.isFinite(requestedConfidence)
        ? Math.max(
            0,
            Math.min(1, requestedConfidence)
          )
        : 0

    if (
      !skill ||
      !evidence ||
      evidence.length > 500 ||
      !source.includes(normalized(evidence))
    ) {
      continue
    }

    const evidenceType: SkillEvidenceType =
      requestedType

    const requiresConfirmation =
      evidenceType === "inferred" ||
      confidence < 0.8

    const key = normalized(skill)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    accepted.push({
      skill,
      evidence,
      sourceSection,
      evidenceType,
      confidence,
      requiresConfirmation,
    })
  }

  return accepted.slice(0, 40)
}

function redactPersonalLines(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const cleaned = line.trim()

      if (!cleaned) {
        return false
      }

      return !(
        /\bidentity\s*(?:number|no)\b/i.test(
          cleaned
        ) ||
        /\b(?:residential|physical|postal)\s+address\b/i.test(
          cleaned
        ) ||
        /\bcontact\s*(?:number|no)\b/i.test(
          cleaned
        ) ||
        /\bemail\s*:/i.test(cleaned) ||
        /(?:\+?\d[\d ()-]{7,}\d)/.test(
          cleaned
        ) ||
        /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(
          cleaned
        )
      )
    })
    .join("\n")
    .slice(0, 18000)
}

export async function extractSkillsFromCv(input: {
  rawText: string
  userId: string
}): Promise<SkillExtractionResult> {
  const sourceText =
    redactPersonalLines(input.rawText)

  if (!sourceText.trim()) {
    return {
      confirmedSkills: [],
      evidence: [],
      pendingSkills: [],
      mode: "ai",
    }
  }

  const completion =
    await executeModelRequest({
      model:
        process.env.CV_SKILL_EXTRACTION_MODEL
          ?.trim() ||
        process.env.CV_ENHANCEMENT_MODEL
          ?.trim() ||
        "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "You extract defensible career skills from CV evidence in any industry, occupation, language style or layout.",
            "Inspect skills sections, qualifications, subjects, certifications, projects, job titles and responsibility statements.",
            "Do not rely on a fixed occupation or technology dictionary.",
            "A skill is explicit only when the CV directly names the capability, tool, method, system, domain knowledge or demonstrated activity.",
            "A vague job title alone must not establish detailed duties, outcomes, tools or financial responsibilities.",
            "Mark a skill inferred when professional interpretation is required beyond the exact wording.",
            "Use a short verbatim evidence fragment copied from the supplied CV for every result.",
            "Never invent skills, employers, duties, metrics, achievements, qualifications or experience.",
            "Do not return proficiency labels such as Advanced, Solid, Expert, Intermediate, Basic, Good or Excellent as skills.",
            "Do not return personal traits unless the CV provides work evidence demonstrating them.",
            "Normalize skill names into concise ATS-readable terminology without overstating the evidence.",
            "Return JSON only in this shape:",
            '{"skills":[{"skill":"ATS-readable skill","evidence":"exact CV fragment","sourceSection":"section or evidence location","evidenceType":"explicit|inferred","confidence":0.0}]}',
            "Return at most 40 distinct skills.",
          ].join("\n"),
        },
        {
          role: "user",
          content: sourceText,
        },
      ],
      retries: 1,
      maxMessages: 2,
      maxContentLength: 18000,
      maxTotalChars: 20000,
      telemetry: {
        userId: input.userId,
        operation: "cv_skill_extraction",
      },
      request: {
        temperature: 0.1,
        response_format: {
          type: "json_object",
        },
      },
    })

  const text =
    extractTextFromCompletion(completion)

  if (!text) {
    throw new Error(
      "Skill extraction returned no content"
    )
  }

  const evidence =
    validateSkillExtractionPayload(
      extractJson(text),
      sourceText
    )

  const confirmedSkills =
    evidence
      .filter(
        (item) =>
          !item.requiresConfirmation
      )
      .map((item) => item.skill)

  const pendingSkills =
    evidence.filter(
      (item) =>
        item.requiresConfirmation
    )

  return {
    confirmedSkills,
    evidence,
    pendingSkills,
    mode: "ai",
  }
}