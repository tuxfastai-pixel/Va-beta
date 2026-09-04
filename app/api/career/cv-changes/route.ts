import {
  NextRequest,
  NextResponse,
} from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import {
  executeModelRequest,
  extractTextFromCompletion,
} from "@/lib/ai/executeModelRequest"
import {
  buildConfirmedEvidence,
  canApproveCvChange,
  validateConfirmationAnswers,
  validateConfirmationQuestions,
  type ConfirmationStatus,
} from "@/lib/career/cvConfirmation"

type ChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"

type ChangeRow =
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

function containsUnsupportedNumbers(
  proposedText: string,
  evidence: string
): boolean {
  const allowed =
    new Set(numericClaims(evidence))

  return numericClaims(proposedText).some(
    (value) => !allowed.has(value)
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
    await executeModelRequest({
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