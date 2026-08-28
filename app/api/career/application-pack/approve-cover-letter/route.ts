import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function POST() {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabaseServer
      .from("job_application_versions")
      .update({ cover_letter_approval_status: "approved" })
      .eq("user_id", session.userId)
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("approve-cover-letter update error:", error)
      return NextResponse.json({ error: "Could not update application pack" }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "No application pack found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, action: "approve-cover-letter" })
  } catch (error) {
    console.error("approve-cover-letter error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
