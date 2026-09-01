import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import {
  executeModelRequest,
  extractTextFromCompletion,
} from "@/lib/ai/executeModelRequest"

export const dynamic = "force-dynamic"

type StructuredProfile = Record<string, unknown>

type ChangeProposal = {
  section: string
  originalText: string
  proposedText: string
  reason: string
  sourceEvidence: string
  confidence: number
}

type EvidenceEntry = {
  section: string
  text: string
}

const ALLOWED_SECTIONS = new Set([
  "professional_summary",
  "work_experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "achievements",
])

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
}

function normalize(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function recordId(
  userId: string,
  generationId: string,
  index: number
) {
  return [
    "cv-change",
    userId,
    generationId,
    index,
  ].join("-")
}

function collectEvidence(
  structured: StructuredProfile
): EvidenceEntry[] {
  const entries: EvidenceEntry[] = []

  const summary = String(
    structured.professionalSummary || ""
  ).trim()

  if (summary) {
    entries.push({
      section: "professional_summary",
      text: summary,
    })
  }

  const mappings: Array<{
    source: string
    section: string
  }> = [
    {
      source: "workExperience",
      section: "work_experience",
    },
    {
      source: "skills",
      section: "skills",
    },
    {
      source: "education",
      section: "education",
    },
    {
      source: "certifications",
      section: "certifications",
    },
    {
      source: "projects",
      section: "projects",
    },
    {
      source: "achievements",
      section: "achievements",
    },
  ]

  for (const mapping of mappings) {
    for (
      const text of asStrings(
        structured[mapping.source]
      )
    ) {
      entries.push({
        section: mapping.section,
        text,
      })
    }
  }

  return entries
}

function extractJson(text: string): unknown {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  return JSON.parse(withoutFence)
}

function numericClaims(text: string): string[] {
  return (
    text.match(
      /\b\d+(?:[.,]\d+)?%?\b/g
    ) || []
  )
}

function hasUnsupportedNumbers(
  proposed: string,
  evidence: string
): boolean {
  const evidenceNumbers =
    new Set(numericClaims(evidence))

  return numericClaims(proposed).some(
    (value) => !evidenceNumbers.has(value)
  )
}

function validateModelChanges(
  raw: unknown,
  evidence: EvidenceEntry[]
): ChangeProposal[] {
  const container =
    isRecord(raw) ? raw.changes : raw

  if (!Array.isArray(container)) {
    return []
  }

  const accepted: ChangeProposal[] = []
  const seen =
    new Set<string>()

  for (const item of container.slice(0, 10)) {
    if (!isRecord(item)) {
      continue
    }

    const section =
      String(item.section || "").trim()

    const requestedOriginal =
      String(item.originalText || "").trim()

    const proposedText =
      String(item.proposedText || "").trim()

    const reason =
      String(item.reason || "").trim()

    if (
      !ALLOWED_SECTIONS.has(section) ||
      !requestedOriginal ||
      !proposedText ||
      !reason
    ) {
      continue
    }

    const originalNormalized =
      normalize(requestedOriginal)

    const matchedEvidence =
      evidence.find(
        (entry) =>
          entry.section === section &&
          (
            normalize(entry.text) ===
              originalNormalized ||
            normalize(entry.text).includes(
              originalNormalized
            ) ||
            originalNormalized.includes(
              normalize(entry.text)
            )
          )
      )

    if (!matchedEvidence) {
      continue
    }

    if (
      normalize(matchedEvidence.text) ===
      normalize(proposedText)
    ) {
      continue
    }

    if (
      hasUnsupportedNumbers(
        proposedText,
        matchedEvidence.text
      )
    ) {
      continue
    }

    const key = [
      section,
      normalize(matchedEvidence.text),
      normalize(proposedText),
    ].join("|")

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    const requestedConfidence =
      Number(item.confidence)

    const confidence =
      Number.isFinite(requestedConfidence)
        ? Math.max(
            0.5,
            Math.min(
              0.95,
              requestedConfidence
            )
          )
        : 0.75

    accepted.push({
      section,
      originalText: matchedEvidence.text,
      proposedText,
      reason,
      sourceEvidence:
        matchedEvidence.text,
      confidence,
    })
  }

  return accepted.slice(0, 8)
}

function uniqueStrings(
  values: string[]
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned =
      value.replace(/\s+/g, " ").trim()

    const key =
      cleaned.toLowerCase()

    if (!cleaned || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function deterministicFallback(
  structured: StructuredProfile
): ChangeProposal[] {
  const changes: ChangeProposal[] = []

  const summary = String(
    structured.professionalSummary || ""
  )

  const normalizedSummary =
    summary.replace(/\s+/g, " ").trim()

  if (
    summary &&
    normalizedSummary !== summary
  ) {
    changes.push({
      section: "professional_summary",
      originalText: summary,
      proposedText: normalizedSummary,
      reason:
        "Normalize spacing while preserving every factual claim.",
      sourceEvidence: summary,
      confidence: 0.99,
    })
  }

  const skills =
    asStrings(structured.skills)

  const uniqueSkills =
    uniqueStrings(skills)

  if (
    skills.length > 0 &&
    uniqueSkills.length !== skills.length
  ) {
    changes.push({
      section: "skills",
      originalText: skills.join(", "),
      proposedText: uniqueSkills.join(", "),
      reason:
        "Remove exact duplicate skills without adding unsupported capabilities.",
      sourceEvidence: skills.join(", "),
      confidence: 0.99,
    })
  }

  return changes
}

async function generateAiChanges(
  structured: StructuredProfile,
  evidence: EvidenceEntry[],
  userId: string
): Promise<ChangeProposal[]> {
  const reviewProfile = {
    professionalSummary:
      String(
        structured.professionalSummary || ""
      ),
    workExperience:
      asStrings(structured.workExperience),
    skills:
      asStrings(structured.skills),
    education:
      asStrings(structured.education),
    certifications:
      asStrings(structured.certifications),
    projects:
      asStrings(structured.projects),
    achievements:
      asStrings(structured.achievements),
    preferredRoles:
      asStrings(structured.preferredRoles),
  }

  const completion =
    await executeModelRequest({
      model:
        process.env.CV_ENHANCEMENT_MODEL
          ?.trim() || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "You are an evidence-controlled CV editor.",
            "Improve clarity, professional tone, ATS readability, and impact.",
            "Never invent employers, duties, achievements, metrics, dates, qualifications, certifications, tools, or experience.",
            "Do not merely repeat the original or append vague phrases.",
            "If evidence is weak, improve wording conservatively.",
            "For skills, separate genuine tools or capabilities and remove proficiency-legend noise.",
            "Each originalText must be copied exactly from one supplied field.",
            "Return JSON only in this shape:",
            '{"changes":[{"section":"professional_summary|work_experience|skills|education|certifications|projects|achievements","originalText":"exact source text","proposedText":"improved text","reason":"specific explanation","confidence":0.0}]}',
            "Return at most eight material improvements.",
          ].join("\n"),
        },
        {
          role: "user",
          content:
            JSON.stringify(reviewProfile),
        },
      ],
      retries: 1,
      maxTotalChars: 18000,
      telemetry: {
        feature: "cv_evidence_review",
        userId,
      },
      request: {
        temperature: 0.2,
        response_format: {
          type: "json_object",
        },
      },
    })

  const text =
    extractTextFromCompletion(completion)

  if (!text) {
    return []
  }

  return validateModelChanges(
    extractJson(text),
    evidence
  )
}

export async function POST() {
  const session =
    await getSessionUser()

  if (!session?.userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    )
  }

  const {
    data: masterProfile,
    error: profileError,
  } = await supabaseServer
    .from("master_career_profiles")
    .select("id, structured_profile")
    .eq("user_id", session.userId)
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    )
  }

  if (!masterProfile) {
    return NextResponse.json(
      {
        error:
          "No master career profile found.",
      },
      { status: 404 }
    )
  }

  const structured =
    (
      masterProfile.structured_profile ||
      {}
    ) as StructuredProfile

  const evidence =
    collectEvidence(structured)

  let generationMode:
    | "ai"
    | "deterministic_fallback" =
      "ai"

  let warning:
    | string
    | undefined

  let changes: ChangeProposal[] = []

  try {
    changes =
      await generateAiChanges(
        structured,
        evidence,
        session.userId
      )

    if (changes.length === 0) {
      throw new Error(
        "The model returned no grounded improvements."
      )
    }
  } catch (error) {
    generationMode =
      "deterministic_fallback"

    changes =
      deterministicFallback(structured)

    warning =
      error instanceof Error
        ? `AI review was unavailable: ${error.message}`
        : "AI review was unavailable."
  }

  // These rows are derived suggestions, not source CV evidence.
  // Regeneration replaces the review for this exact profile.
  const {
    error: clearError,
  } = await supabaseServer
    .from("cv_change_records")
    .delete()
    .eq("user_id", session.userId)
    .eq(
      "profile_id",
      String(masterProfile.id)
    )

  if (clearError) {
    return NextResponse.json(
      { error: clearError.message },
      { status: 500 }
    )
  }

  const generationId =
    Date.now().toString(16)

  const rows =
    changes.map(
      (change, index) => ({
        id: recordId(
          session.userId,
          generationId,
          index
        ),
        user_id: session.userId,
        profile_id:
          String(masterProfile.id),
        section: change.section,
        original_text:
          change.originalText,
        proposed_text:
          change.proposedText,
        reason: change.reason,
        source_evidence:
          change.sourceEvidence,
        confidence: change.confidence,
        user_approval_status:
          "pending",
      })
    )

  if (rows.length > 0) {
    const { error } =
      await supabaseServer
        .from("cv_change_records")
        .insert(rows)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    success: true,
    profileId: masterProfile.id,
    generationMode,
    warning,
    changes: rows,
    constraints: {
      inventEmployment: false,
      inventQualifications: false,
      inventCertifications: false,
      fabricateExperienceYears: false,
      claimUnsupportedTools: false,
      addUnsupportedAchievements: false,
    },
  })
}