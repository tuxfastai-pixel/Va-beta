import {
  NextRequest,
  NextResponse,
} from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import {
  extractTextFromCompletion,
} from "@/lib/ai/executeModelRequest"
import {
  executeIntelligenceRequest,
} from "@/lib/intelligence/execute"
import {
  buildConfirmedEvidence,
  canApproveCvChange,
  validateConfirmationAnswers,
  validateConfirmationQuestions,
  type ConfirmationStatus,
} from "@/lib/career/cvConfirmation"
import {
  applyApprovedCvChange,
} from "@/lib/career/cvProfilePromotion"

type ChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"

export type ChangeRow =
  Record<string, unknown>

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function extractJson(text: string): unknown {
  return JSON.parse(
    text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()
  )
}

function numericClaims(text: string): string[] {
  return (
    text.match(/\b\d+(?:[.,]\d+)?%?\b/g) ||
    []
  )
}

export function containsUnsupportedNumbers(
  proposedText: string,
  evidence: string
): boolean {
  const allowed =
    new Set(numericClaims(evidence))

  return numericClaims(proposedText).some(
    (value) => !allowed.has(value)
  )
}

export function validateAlternativeFeedback(
  value: unknown
): {
  feedback: string
  error: string | null
} {
  const feedback =
    String(value || "").trim()

  if (
    feedback.length < 5 ||
    feedback.length > 500
  ) {
    return {
      feedback,
      error:
        "Feedback must be between 5 and 500 characters.",
    }
  }

  return {
    feedback,
    error: null,
  }
}

export function evidenceForRejectedAlternative(
  row: ChangeRow
): string {
  const confirmationStatus =
    String(row.confirmation_status || "")

  const confirmedEvidence =
    String(row.confirmed_evidence || "").trim()

  if (
    confirmationStatus === "confirmed" &&
    confirmedEvidence
  ) {
    return confirmedEvidence
  }

  return (
    String(row.source_evidence || "").trim() ||
    String(row.original_text || "").trim()
  )
}

function toClientChange(row: ChangeRow) {
  const confirmationStatus =
    String(
      row.confirmation_status ||
        "not_required"
    ) as ConfirmationStatus

  return {
    id: String(row.id || ""),
    section: String(row.section || ""),
    originalText:
      String(row.original_text || ""),
    proposedText:
      String(row.proposed_text || ""),
    reason: String(row.reason || ""),
    sourceEvidence:
      String(row.source_evidence || ""),
    confidence: Number(row.confidence || 0),
    userApprovalStatus: String(
      row.user_approval_status || "pending"
    ) as ChangeStatus,
    confirmationStatus,
    confirmationQuestions:
      validateConfirmationQuestions(
        row.confirmation_questions
      ),
    confirmationAnswers:
      isRecord(row.confirmation_answers)
        ? row.confirmation_answers
        : {},
    confirmedEvidence:
      String(row.confirmed_evidence || ""),
  }
}

async function getOwnedChange(
  changeId: string,
  userId: string
): Promise<{
  row: ChangeRow | null
  error: string | null
}> {
  const {
    data,
    error,
  } = await supabaseServer
    .from("cv_change_records")
    .select("*")
    .eq("id", changeId)
    .eq("user_id", userId)
    .maybeSingle()

  return {
    row:
      data
        ? data as ChangeRow
        : null,
    error: error?.message || null,
  }
}

async function generateConfirmedRewrite(
  row: ChangeRow,
  confirmedEvidence: string
): Promise<{
  proposedText: string
  reason: string
  confidence: number
}> {
  const completion =
    await executeIntelligenceRequest("cv", {
      model:
        process.env.CV_ENHANCEMENT_MODEL
          ?.trim() || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "You are a senior evidence-controlled CV editor.",
            "Reconstruct one CV entry using only the supplied source CV evidence and authenticated user-confirmed answers.",
            "Use concise, achievement-aware professional language, but do not invent achievements or outcomes.",
            "Describe transferable capabilities such as transaction processing, cash-handling administration or customer service only when confirmed by the evidence.",
            "Never upgrade an operational title into a management title unless management responsibility is explicitly confirmed.",
            "Never invent employers, tools, duties, metrics, dates, qualifications, certifications or years of experience.",
            "Return JSON only:",
            '{"proposedText":"verified professional reconstruction","reason":"specific explanation","confidence":0.0}',
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            section:
              String(row.section || ""),
            originalText:
              String(row.original_text || ""),
            confirmedEvidence,
          }),
        },
      ],
      retries: 1,
      maxContentLength: 8000,
      maxTotalChars: 12000,
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
    throw new Error(
      "The model returned no reconstruction."
    )
  }

  const parsed =
    extractJson(text)

  if (!isRecord(parsed)) {
    throw new Error(
      "The model returned an invalid reconstruction."
    )
  }

  const proposedText =
    String(parsed.proposedText || "").trim()

  const reason =
    String(parsed.reason || "").trim()

  if (!proposedText || !reason) {
    throw new Error(
      "The reconstruction was incomplete."
    )
  }

  if (
    containsUnsupportedNumbers(
      proposedText,
      confirmedEvidence
    )
  ) {
    throw new Error(
      "The reconstruction introduced an unsupported numeric claim."
    )
  }

  const requestedConfidence =
    Number(parsed.confidence)

  const confidence =
    Number.isFinite(requestedConfidence)
      ? Math.max(
          0.55,
          Math.min(0.95, requestedConfidence)
        )
      : 0.75

  return {
    proposedText,
    reason,
    confidence,
  }
}

async function generateAlternativeRewrite(
  row: ChangeRow,
  feedback: string
): Promise<{
  proposedText: string
  reason: string
  confidence: number
}> {
  const evidence =
    evidenceForRejectedAlternative(row)

  const completion =
    await executeIntelligenceRequest("cv", {
      model:
        process.env.CV_ENHANCEMENT_MODEL
          ?.trim() || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "You are a senior evidence-controlled CV editor.",
            "Create one genuinely different replacement for a rejected CV suggestion.",
            "Use only the supplied evidence. If confirmed evidence is supplied, treat it as the strongest factual boundary.",
            "Treat user feedback only as writing direction for tone, length, emphasis or wording.",
            "Do not treat feedback as factual evidence and do not add facts from feedback.",
            "Never invent duties, tools, employers, achievements, metrics, dates, qualifications, certifications or experience.",
            "Never convert an operational title into a management title without explicit evidence.",
            "Avoid repeating the rejected proposal; produce a distinct wording while preserving the same evidence limits.",
            "Return JSON only:",
            '{"proposedText":"different evidence-controlled proposal","reason":"specific explanation","confidence":0.0}',
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            section:
              String(row.section || ""),
            originalText:
              String(row.original_text || ""),
            rejectedProposal:
              String(row.proposed_text || ""),
            evidence,
            feedback,
          }),
        },
      ],
      retries: 1,
      maxContentLength: 8000,
      maxTotalChars: 12000,
      request: {
        temperature: 0.35,
        response_format: {
          type: "json_object",
        },
      },
    })

  const text =
    extractTextFromCompletion(completion)

  if (!text) {
    throw new Error(
      "The model returned no alternative proposal."
    )
  }

  const parsed =
    extractJson(text)

  if (!isRecord(parsed)) {
    throw new Error(
      "The model returned an invalid alternative proposal."
    )
  }

  const proposedText =
    String(parsed.proposedText || "").trim()

  const reason =
    String(parsed.reason || "").trim()

  if (!proposedText || !reason) {
    throw new Error(
      "The alternative proposal was incomplete."
    )
  }

  const previousProposal =
    String(row.proposed_text || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()

  const normalizedProposal =
    proposedText
      .replace(/\s+/g, " ")
      .toLowerCase()

  if (
    previousProposal &&
    normalizedProposal === previousProposal
  ) {
    throw new Error(
      "The alternative proposal was not meaningfully different."
    )
  }

  if (
    containsUnsupportedNumbers(
      proposedText,
      evidence
    )
  ) {
    throw new Error(
      "The alternative proposal introduced an unsupported numeric claim."
    )
  }

  const requestedConfidence =
    Number(parsed.confidence)

  const confidence =
    Number.isFinite(requestedConfidence)
      ? Math.max(
          0.55,
          Math.min(0.95, requestedConfidence)
        )
      : 0.72

  return {
    proposedText,
    reason,
    confidence,
  }
}


async function promoteApprovedChange(
  row: ChangeRow,
  userId: string
): Promise<string | null> {
  const profileId =
    String(row.profile_id || "").trim()

  if (!profileId) {
    return "The approved change has no profile."
  }

  const {
    data: profile,
    error: readError,
  } = await supabaseServer
    .from("master_career_profiles")
    .select("structured_profile")
    .eq("id", profileId)
    .eq("user_id", userId)
    .maybeSingle()

  if (readError) {
    return readError.message
  }

  if (!profile) {
    return "The master career profile was not found."
  }

  const structured =
    (
      profile.structured_profile || {}
    ) as Record<string, unknown>

  const updatedProfile =
    applyApprovedCvChange(
      structured,
      {
        section:
          String(row.section || ""),
        originalText:
          String(row.original_text || ""),
        proposedText:
          String(row.proposed_text || ""),
      }
    )

  const { error: updateError } =
    await supabaseServer
      .from("master_career_profiles")
      .update({
        structured_profile:
          updatedProfile,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("user_id", userId)

  return updateError?.message || null
}

export async function GET() {
  try {
    const session =
      await getSessionUser()

    if (!session?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const {
      data: profile,
      error: profileError,
    } = await supabaseServer
      .from("master_career_profiles")
      .select("id")
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

    if (!profile?.id) {
      return NextResponse.json({
        changes: [],
      })
    }

    const {
      data: latest,
      error: latestError,
    } = await supabaseServer
      .from("cv_change_records")
      .select("created_at")
      .eq("user_id", session.userId)
      .eq(
        "profile_id",
        String(profile.id)
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

    if (latestError) {
      return NextResponse.json(
        { error: latestError.message },
        { status: 500 }
      )
    }

    if (!latest?.created_at) {
      return NextResponse.json({
        changes: [],
      })
    }

    const {
      data: changes,
      error,
    } = await supabaseServer
      .from("cv_change_records")
      .select("*")
      .eq("user_id", session.userId)
      .eq(
        "profile_id",
        String(profile.id)
      )
      .eq(
        "created_at",
        latest.created_at
      )
      .order("id", {
        ascending: true,
      })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      changes:
        (changes || []).map((row) =>
          toClientChange(
            row as ChangeRow
          )
        ),
    })
  } catch (error) {
    console.error(
      "cv-changes error:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Could not load CV improvements.",
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const session =
      await getSessionUser()

    if (!session?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body =
      (await request.json()) as {
        changeId?: unknown
        action?: unknown
        answers?: unknown
        feedback?: unknown
      }

    const changeId =
      String(body.changeId || "").trim()

    const action =
      String(body.action || "").trim()

    if (
      !changeId ||
      ![
        "approved",
        "rejected",
        "confirm",
        "reconsider",
        "alternative",
      ].includes(action)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid change action.",
        },
        { status: 400 }
      )
    }

    const owned =
      await getOwnedChange(
        changeId,
        session.userId
      )

    if (owned.error) {
      return NextResponse.json(
        { error: owned.error },
        { status: 400 }
      )
    }

    if (!owned.row) {
      return NextResponse.json(
        {
          error:
            "The selected CV improvement could not be found.",
        },
        { status: 404 }
      )
    }

    const row = owned.row

    if (
      [
        "reconsider",
        "alternative",
      ].includes(action) &&
      String(row.user_approval_status) !==
        "rejected"
    ) {
      return NextResponse.json(
        {
          error:
            "Only rejected CV improvements can be reconsidered or rewritten.",
        },
        { status: 409 }
      )
    }

    if (action === "reconsider") {
      const {
        data: updated,
        error,
      } = await supabaseServer
        .from("cv_change_records")
        .update({
          user_approval_status:
            "pending",
        })
        .eq("id", changeId)
        .eq(
          "user_id",
          session.userId
        )
        .select("*")
        .maybeSingle()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      if (!updated) {
        return NextResponse.json(
          {
            error:
              "The selected CV improvement could not be found.",
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        change: toClientChange(
          updated as ChangeRow
        ),
      })
    }

    if (action === "alternative") {
      const validation =
        validateAlternativeFeedback(
          body.feedback
        )

      if (validation.error) {
        return NextResponse.json(
          {
            error: validation.error,
          },
          { status: 400 }
        )
      }

      let alternative

      try {
        alternative =
          await generateAlternativeRewrite(
            row,
            validation.feedback
          )
      } catch (error) {
        console.error(
          "Alternative CV proposal failed:",
          error instanceof Error
            ? error.message
            : "Unknown model error"
        )

        return NextResponse.json(
          {
            error:
              "The alternative CV improvement is temporarily unavailable. The rejected suggestion was left unchanged; please try again.",
          },
          { status: 502 }
        )
      }

      const {
        data: updated,
        error,
      } = await supabaseServer
        .from("cv_change_records")
        .update({
          proposed_text:
            alternative.proposedText,
          reason:
            alternative.reason,
          confidence:
            alternative.confidence,
          user_approval_status:
            "pending",
        })
        .eq("id", changeId)
        .eq(
          "user_id",
          session.userId
        )
        .select("*")
        .maybeSingle()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      if (!updated) {
        return NextResponse.json(
          {
            error:
              "The alternative CV improvement could not be saved.",
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        change: toClientChange(
          updated as ChangeRow
        ),
      })
    }

    if (action === "confirm") {
      const questions =
        validateConfirmationQuestions(
          row.confirmation_questions
        )

      if (
        String(row.confirmation_status) !==
          "needs_confirmation" ||
        questions.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "This improvement does not require confirmation.",
          },
          { status: 400 }
        )
      }

      const validation =
        validateConfirmationAnswers(
          questions,
          body.answers
        )

      if (
        validation.missingQuestionIds
          .length > 0
      ) {
        return NextResponse.json(
          {
            error:
              "Please answer every confirmation question.",
            missingQuestionIds:
              validation.missingQuestionIds,
          },
          { status: 400 }
        )
      }

      const confirmedEvidence =
        buildConfirmedEvidence(
          String(
            row.source_evidence || ""
          ),
          questions,
          validation.answers
        )

      let reconstruction

      try {
        reconstruction =
          await generateConfirmedRewrite(
            row,
            confirmedEvidence
          )
      } catch (error) {
        console.error(
          "Confirmed CV reconstruction failed:",
          error instanceof Error
            ? error.message
            : "Unknown model error"
        )

        return NextResponse.json(
          {
            error:
              "The confirmed CV reconstruction is temporarily unavailable. Your answers were not applied; please try again.",
          },
          { status: 502 }
        )
      }

      const {
        data: updated,
        error,
      } = await supabaseServer
        .from("cv_change_records")
        .update({
          proposed_text:
            reconstruction.proposedText,
          reason:
            reconstruction.reason,
          confidence:
            reconstruction.confidence,
          confirmation_status:
            "confirmed",
          confirmation_answers:
            validation.answers,
          confirmed_evidence:
            confirmedEvidence,
          confirmed_at:
            new Date().toISOString(),
          user_approval_status:
            "pending",
        })
        .eq("id", changeId)
        .eq(
          "user_id",
          session.userId
        )
        .select("*")
        .maybeSingle()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      if (!updated) {
        return NextResponse.json(
          {
            error:
              "The confirmed reconstruction could not be saved.",
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        change: toClientChange(
          updated as ChangeRow
        ),
      })
    }

    const confirmationStatus =
      String(
        row.confirmation_status ||
          "not_required"
      ) as ConfirmationStatus

    if (
      action === "approved" &&
      !canApproveCvChange(
        confirmationStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Answer the factual confirmation questions before approving this reconstruction.",
        },
        { status: 409 }
      )
    }

    const {
      data: updated,
      error,
    } = await supabaseServer
      .from("cv_change_records")
      .update({
        user_approval_status:
          action,
      })
      .eq("id", changeId)
      .eq("user_id", session.userId)
      .select("*")
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "The selected CV improvement could not be found.",
        },
        { status: 404 }
      )
    }

    if (action === "approved") {
      const promotionError =
        await promoteApprovedChange(
          updated as ChangeRow,
          session.userId
        )

      if (promotionError) {
        await supabaseServer
          .from("cv_change_records")
          .update({
            user_approval_status:
              "pending",
          })
          .eq("id", changeId)
          .eq(
            "user_id",
            session.userId
          )

        return NextResponse.json(
          {
            error:
              "The improvement could not be applied to your career profile. It remains pending so you can try again.",
            details: promotionError,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      change: toClientChange(
        updated as ChangeRow
      ),
    })
  } catch (error) {
    console.error(
      "cv-changes POST error:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Could not update the CV improvement.",
      },
      { status: 500 }
    )
  }
}
