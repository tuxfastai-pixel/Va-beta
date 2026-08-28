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
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !appPack) {
      return NextResponse.json({
        jobTitle: null,
        jobCompany: null,
        matchScore: 0,
        matchExplanation: "No job selected",
        cvPreview: null,
        coverLetterText: null,
        cvApprovalStatus: "pending",
        coverLetterApprovalStatus: "pending",
        interviewReadiness: null,
        riskWarnings: [],
      })
    }

    return NextResponse.json({
      jobTitle: appPack.job_title,
      jobCompany: appPack.company_name,
      matchScore: appPack.match_score || 0,
      matchExplanation: appPack.match_explanation,
      cvPreview: appPack.tailored_cv_content,
      coverLetterText: appPack.cover_letter_text,
      cvApprovalStatus: appPack.cv_approval_status || "pending",
      coverLetterApprovalStatus: appPack.cover_letter_approval_status || "pending",
      interviewReadiness: appPack.interview_readiness_notes,
      riskWarnings: appPack.risk_warnings || [],
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

    if (action === "approve-cv") {
      const { error } = await supabaseServer
        .from("job_application_versions")
        .update({ cv_approval_status: "approved" })
        .eq("user_id", session.userId)
        .order("created_at", { ascending: false })
        .limit(1)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "approve-cover-letter") {
      const { error } = await supabaseServer
        .from("job_application_versions")
        .update({ cover_letter_approval_status: "approved" })
        .eq("user_id", session.userId)
        .order("created_at", { ascending: false })
        .limit(1)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("application-pack POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
