import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch master profile for user
    const { data: profile, error } = await supabaseServer
      .from("master_career_profiles")
      .select("*")
      .eq("user_id", session.userId)
      .single()

    if (error) {
      console.error("master-profile fetch error:", error)
      return NextResponse.json({ profile: null })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("master-profile error:", error)
    return NextResponse.json({ profile: null }, { status: 500 })
  }
}
