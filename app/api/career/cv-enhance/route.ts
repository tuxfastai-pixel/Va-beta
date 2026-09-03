import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import {
  executeModelRequest,
  extractTextFromCompletion,
} from "@/lib/ai/executeModelRequest"
import {
  validateConfirmationQuestions,
  type ConfirmationQuestion,
} from "@/lib/career/cvConfirmation"

export const dynamic = "force-dynamic"

type StructuredProfile = Record<string, unknown>

type ChangeProposal = {
  section: string
  originalText: string
  proposedText: string
  reason: string
  sourceEvidence: string
  confidence: number
  confirmationStatus:
    | "not_required"
    | "needs_confirmation"
  confirmationQuestions: ConfirmationQuestion[]
}

type EvidenceEntry = {
  id: string
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

  const addEvidence = (
    section: string,
    text: string
  ) => {
    const cleaned = text.trim()

    if (!cleaned) {
      return
    }

    entries.push({
      id: `evidence-${entries.length + 1}`,
      section,
      text: cleaned,
    })
  }

  addEvidence(
    "professional_summary",
    String(
      structured.professionalSummary || ""
    )
  )

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
      addEvidence(mapping.section, text)
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

function comparisonKey(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "")
}

function wordCount(value: string): number {
  return normalize(value)
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function requiresWorkConfirmation(
  section: string,
  originalText: string,
  proposedText: string
): boolean {
  if (section !== "work_experience") {
    return false
  }

  const responsibility =
    originalText.match(
      /responsibilit(?:y|ies)\s*:\s*([^\r\n]+)/i
    )?.[1] || ""

  const position =
    originalText.match(
      /position(?:\s+held)?\s*:\s*([^\r\n]+)/i
    )?.[1] || ""

  const sparseEvidence =
    (
      responsibility &&
      wordCount(responsibility) <= 4
    ) ||
    (
      !responsibility &&
      position &&
      wordCount(position) <= 4
    ) ||
    wordCount(originalText) <= 5

  return Boolean(
    sparseEvidence &&
    wordCount(proposedText) >
      wordCount(originalText) + 3
  )
}

function fallbackWorkQuestions():
  ConfirmationQuestion[] {
  return [
    {
      id: "actual-duties",
      prompt:
        "Which tasks did you personally perform in this role?",
    },
    {
      id: "tools-and-transactions",
      prompt:
        "Which tools, systems, payment methods or transaction processes did you personally use?",
    },
    {
      id: "records-and-reconciliation",
      prompt:
        "Did you balance, reconcile, record or report any transactions? If yes, describe exactly what you did.",
    },
  ]
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
  const seen = new Set<string>()

  for (const item of container.slice(0, 10)) {
    if (!isRecord(item)) {
      continue
    }

    const evidenceId =
      String(item.evidenceId || "").trim()

    const section =
      String(item.section || "").trim()

    const proposedText =
      String(item.proposedText || "").trim()

    const reason =
      String(item.reason || "").trim()

    if (
      !evidenceId ||
      !ALLOWED_SECTIONS.has(section) ||
      !proposedText ||
      !reason
    ) {
      continue
    }

    const matchedEvidence =
      evidence.find(
        (entry) =>
          entry.id === evidenceId &&
          entry.section === section
      )

    if (!matchedEvidence) {
      continue
    }

    if (
      comparisonKey(matchedEvidence.text) ===
      comparisonKey(proposedText)
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
      evidenceId,
      comparisonKey(proposedText),
    ].join("|")

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    let confirmationQuestions =
      validateConfirmationQuestions(
        item.confirmationQuestions
      )

    const needsConfirmation =
      item.requiresConfirmation === true ||
      requiresWorkConfirmation(
        section,
        matchedEvidence.text,
        proposedText
      )

    if (
      needsConfirmation &&
      confirmationQuestions.length === 0
    ) {
      confirmationQuestions =
        fallbackWorkQuestions()
    }

    const requestedConfidence =
      Number(item.confidence)

    const confidence =
      Number.isFinite(requestedConfidence)
        ? Math.max(
            0.55,
            Math.min(
              0.9,
              requestedConfidence
            )
          )
        : 0.7

    accepted.push({
      section,
      originalText: matchedEvidence.text,
      proposedText,
      reason,
      sourceEvidence: matchedEvidence.text,
      confidence,
      confirmationStatus:
        needsConfirmation
          ? "needs_confirmation"
          : "not_required",
      confirmationQuestions,
    })
  }

  return accepted.slice(0, 8)
}

function prepareModelEvidence(
  evidence: EvidenceEntry[]
): EvidenceEntry[] {
  const result: EvidenceEntry[] = []
  const totalBudget = 12000
  const entryLimit = 2000
  let used = 0

  for (const entry of evidence) {
    const remaining = totalBudget - used

    if (remaining < 100) {
      break
    }

    const text = entry.text.slice(
      0,
      Math.min(entryLimit, remaining)
    )

    if (!text.trim()) {
      continue
    }

    result.push({
      ...entry,
      text,
    })

    used += text.length
  }

  return result
}

async function generateAiChanges(
  structured: StructuredProfile,
  evidence: EvidenceEntry[]
): Promise<ChangeProposal[]> {
  const reviewProfile = {
    evidence:
      prepareModelEvidence(evidence),
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
            "You are a senior CV editor producing material, employer-focused improvements.",
            "Use only the supplied evidence and preferred-role context.",
            "Rewrite passive, repetitive, outdated or unclear wording into concise professional CV language.",
            "For a professional summary, emphasize demonstrated direction, capabilities and value without inventing experience.",
            "For work experience, improve clarity and action orientation without inventing outcomes or responsibilities.",
            "When the evidence only names a role or gives a vague duty such as Cashier, Teller, Technician or Support, do not silently infer detailed duties.",
            "Set requiresConfirmation to true when a stronger reconstruction depends on duties, tools, transactions, records, outcomes or responsibilities that the evidence does not explicitly confirm.",
            "For those entries, provide one to five short factual confirmationQuestions with stable lowercase IDs.",
            "A question must ask only for information needed to verify the proposed reconstruction.",
            "Never invent employers, duties, achievements, metrics, dates, qualifications, certifications, tools or years of experience.",
            "Do not return spelling-only, punctuation-only, capitalization-only or spacing-only changes.",
            "Do not repeat the source with vague phrases appended.",
            "Every suggestion must reference exactly one supplied evidenceId and its matching section.",
            "Omit an entry when no material evidence-controlled improvement is possible.",
            "Return JSON only in this shape:",
            '{"changes":[{"evidenceId":"evidence-1","section":"professional_summary|work_experience|skills|education|certifications|projects|achievements","proposedText":"materially improved text","reason":"specific explanation","confidence":0.0,"requiresConfirmation":false,"confirmationQuestions":[{"id":"actual-duties","prompt":"Which duties did you personally perform?"}]}]}',
            "Return at most eight distinct material improvements.",
          ].join("\n"),
        },
        {
          role: "user",
          content:
            JSON.stringify(reviewProfile),
        },
      ],
      retries: 1,
      maxContentLength: 16000,
      maxTotalChars: 20000,
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

  let changes: ChangeProposal[]

  try {
    changes =
      await generateAiChanges(
        structured,
        evidence
      )
  } catch (error) {
    console.error(
      "CV AI review failed:",
      error instanceof Error
        ? error.message
        : "Unknown model error"
    )

    return NextResponse.json(
      {
        error:
          "The AI CV review is temporarily unavailable. Your CV was saved, but no fallback suggestion was presented. Please try again.",
        generationMode: "failed",
      },
      { status: 502 }
    )
  }

  if (changes.length === 0) {
    return NextResponse.json(
      {
        error:
          "The AI returned no material evidence-based improvements. No cosmetic fallback was created.",
        generationMode: "no_material_changes",
      },
      { status: 422 }
    )
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
        confirmation_status:
          change.confirmationStatus,
        confirmation_questions:
          change.confirmationQuestions,
        confirmation_answers: {},
        confirmed_evidence: "",
        confirmed_at: null,
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
    generationMode: "ai",
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
