import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

type ChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"

function toClientChange(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    section: String(row.section || ""),
    originalText: String(row.original_text || ""),
    proposedText: String(row.proposed_text || ""),
    reason: String(row.reason || ""),
    sourceEvidence: String(row.source_evidence || ""),
    confidence: Number(row.confidence || 0),
    userApprovalStatus: String(
      row.user_approval_status || "pending"
    ) as ChangeStatus,
  }
}

export async function GET() {
  try {
    const session = await getSessionUser()

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
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    if (!profile?.id) {
      return NextResponse.json({ changes: [] })
    }

    const {
      data: latest,
      error: latestError,
    } = await supabaseServer
      .from("cv_change_records")
      .select("created_at")
      .eq("user_id", session.userId)
      .eq("profile_id", String(profile.id))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError) {
      return NextResponse.json(
        { error: latestError.message },
        { status: 500 }
      )
    }

    if (!latest?.created_at) {
      return NextResponse.json({ changes: [] })
    }

    const {
      data: changes,
      error,
    } = await supabaseServer
      .from("cv_change_records")
      .select("*")
      .eq("user_id", session.userId)
      .eq("profile_id", String(profile.id))
      .eq("created_at", latest.created_at)
      .order("id", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      changes: (changes || []).map((row) =>
        toClientChange(
          row as Record<string, unknown>
        )
      ),
    })
  } catch (error) {
    console.error("cv-changes error:", error)

    return NextResponse.json(
      { error: "Could not load CV improvements." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()

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
      }

    const changeId =
      String(body.changeId || "").trim()

    const action =
      String(body.action || "").trim()

    if (
      !changeId ||
      !["approved", "rejected"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Invalid change action." },
        { status: 400 }
      )
    }

    const {
      data: updated,
      error,
    } = await supabaseServer
      .from("cv_change_records")
      .update({
        user_approval_status: action,
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
        updated as Record<string, unknown>
      ),
    })
  } catch (error) {
    console.error("cv-changes POST error:", error)

    return NextResponse.json(
      { error: "Could not update the CV improvement." },
      { status: 500 }
    )
  }
}