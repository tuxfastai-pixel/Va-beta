import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch CV changes for user
    const { data: changes, error } = await supabaseServer
      .from("cv_change_records")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("cv-changes fetch error:", error)
      return NextResponse.json({ changes: [] })
    }

    return NextResponse.json({ changes: changes || [] })
  } catch (error) {
    console.error("cv-changes error:", error)
    return NextResponse.json({ changes: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { changeId, action } = body

    if (!changeId || !action) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    // Update change record approval status
    const { error } = await supabaseServer
      .from("cv_change_records")
      .update({ user_approval_status: action })
      .eq("id", changeId)
      .eq("user_id", session.userId)

    if (error) {
      console.error("cv-change update error:", error)
      return NextResponse.json({ error: "Update failed" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("cv-changes POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
