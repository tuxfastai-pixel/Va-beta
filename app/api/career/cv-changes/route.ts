import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

function toClientChange(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    section: String(row.section || ""),
    originalText: String(row.original_text || ""),
    proposedText: String(row.proposed_text || ""),
    reason: String(row.reason || ""),
    sourceEvidence: String(row.source_evidence || ""),
    confidence: Number(row.confidence || 0),
    userApprovalStatus: String(row.user_approval_status || "pending"),
  }
}

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: changes, error } = await supabaseServer
      .from("cv_change_records")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      changes: (changes || []).map((row) =>
        toClientChange(row as Record<string, unknown>)
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const changeId = String(body.changeId || "")
    const action = String(body.action || "")

    if (!changeId || !["approved", "rejected"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid change action." },
        { status: 400 }
      )
    }

    const { error } = await supabaseServer
      .from("cv_change_records")
      .update({ user_approval_status: action })
      .eq("id", changeId)
      .eq("user_id", session.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("cv-changes POST error:", error)
    return NextResponse.json(
      { error: "Could not update the CV improvement." },
      { status: 500 }
    )
  }
}