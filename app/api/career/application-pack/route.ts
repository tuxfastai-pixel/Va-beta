import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch the last job application version (application pack)
    const { data: appPack, error } = await supabaseServer
      .from("job_application_versions")
      .select("id,source_job,assessment,tailored_cv,cover_letter,application_status")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!appPack) {
      return NextResponse.json(
        { error: "Complete a job assessment before building an application pack." },
        { status: 404 }
      )
    }

    const sourceJob =
      (appPack.source_job || {}) as Record<string, unknown>
    const assessment =
      (appPack.assessment || {}) as Record<string, unknown>
    const tailoredCv =
      (appPack.tailored_cv || {}) as Record<string, unknown>

    const { data: journey } =
      await supabaseServer
        .from("career_journey_state")
        .select("cv_approval_status,cover_letter_approval_status")
        .eq("user_id", session.userId)
        .maybeSingle()

    return NextResponse.json({
      jobTitle: String(sourceJob.title || "") || null,
      jobCompany: String(sourceJob.company || "") || null,
      matchScore: Number(assessment.matchScore ?? 0),
      matchExplanation:
        String(assessment.matchExplanation || ""),
      cvPreview:
        Object.keys(tailoredCv).length > 0
          ? tailoredCv
          : null,
      coverLetterText: appPack.cover_letter || null,
      cvApprovalStatus:
        journey?.cv_approval_status || "pending",
      coverLetterApprovalStatus:
        journey?.cover_letter_approval_status || "pending",
      interviewReadiness:
        (assessment.scoreBreakdown as Record<string, unknown> | undefined)
          ?.interviewReadinessScore ?? null,
      riskWarnings:
        Array.isArray(assessment.riskFlags)
          ? assessment.riskFlags
          : [],
    })
  } catch (error) {
    console.error("application-pack error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === "approve-cv" || action === "approve-cover-letter") {
      const column =
        action === "approve-cv"
          ? "cv_approval_status"
          : "cover_letter_approval_status"

      const { error } = await supabaseServer
        .from("career_journey_state")
        .upsert({
          user_id: session.userId,
          [column]: "approved",
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("application-pack POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
