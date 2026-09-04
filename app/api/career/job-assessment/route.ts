import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch the last job assessment for the current user
    const { data: assessment, error } = await supabaseServer
      .from("job_application_versions")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !assessment) {
      return NextResponse.json({
        matchScore: 0,
        matchExplanation: "No assessment available",
        strengths: [],
        missingSkills: [],
      })
    }

    return NextResponse.json({
      matchScore: assessment.match_score || 0,
      matchExplanation: assessment.match_explanation || "Assessment pending",
      strengths: assessment.verified_strengths || [],
      missingSkills: assessment.missing_requirements || [],
    })
  } catch (error) {
    console.error("job-assessment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
