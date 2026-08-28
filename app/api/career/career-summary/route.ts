import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch career summary (combination of profile + readiness scores)
    const { data: profile, error } = await supabaseServer
      .from("master_career_profiles")
      .select("*")
      .eq("user_id", session.userId)
      .single()

    if (error) {
      console.error("career-summary fetch error:", error)
      return NextResponse.json({
        careerLanes: null,
        readiness: {},
        skills: [],
      })
    }

    return NextResponse.json({
      careerLanes: profile?.career_lanes,
      readiness: {
        paymentReadiness: profile?.payment_readiness || "Not assessed",
        internationalReadiness: profile?.international_readiness || "Not assessed",
        remoteReadiness: profile?.remote_readiness || "Not assessed",
      },
      skills: profile?.skills || [],
    })
  } catch (error) {
    console.error("career-summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
