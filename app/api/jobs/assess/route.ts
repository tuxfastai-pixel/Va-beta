import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { assessJobFit, buildLearningSprint, mapAiCapabilityByTask, parseJobDescription } from "@/lib/career/jobAssessment"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

type Body = {
  title?: string
  description?: string
  location?: string
  salary?: string
}

function fingerprint(input: string) {
  return `job-${Buffer.from(input).toString("base64").slice(0, 18).replace(/[^a-zA-Z0-9]/g, "")}`
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Body
  const description = String(body.description || "").trim()
  if (!description) {
    return NextResponse.json({ error: "Job description is required" }, { status: 400 })
  }

  const parsedJob = parseJobDescription({
    title: body.title,
    description,
    location: body.location,
    salary: body.salary,
  })

  const { data: profileRow, error: profileError } = await supabaseServer
    .from("master_career_profiles")
    .select("id, structured_profile")
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!profileRow) {
    return NextResponse.json({ error: "No master career profile found." }, { status: 404 })
  }

  const structured = (profileRow.structured_profile || {}) as Record<string, unknown>
  const assessment = assessJobFit({
    parsedJob,
    profile: {
      translatedSkills: Array.isArray(structured.skills) ? structured.skills.map(String) : [],
      hiddenSkills: Array.isArray(structured.projects) ? structured.projects.map(String) : [],
      profileConfidence: 0.72,
      internationalPaymentReadinessScore: Number(structured.internationalPaymentReadiness || 60),
    },
  })

  const learningSprint = buildLearningSprint({
    missingSkills: assessment.missingSkills,
    roleTitle: parsedJob.title,
  })

  const jobFingerprint = fingerprint(`${parsedJob.title}:${parsedJob.description.slice(0, 120)}`)
  const aiCapabilityMap = mapAiCapabilityByTask(parsedJob.responsibilities)

  const { error: storeError } = await supabaseServer
    .from("job_application_versions")
    .upsert(
      {
        id: `job-version-${session.userId}-${Date.now().toString(16)}`,
        user_id: session.userId,
        job_fingerprint: jobFingerprint,
        source_job: parsedJob,
        assessment,
        tailored_cv: {
          summary: "Generated from verified profile only.",
          note: "Master profile remains immutable.",
        },
        cover_letter: null,
        application_status: "ready_to_apply",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    jobFingerprint,
    parsedJob,
    assessment,
    recommendationBand: assessment.band,
    learningSprint,
    aiCapabilityMap,
    pilotMode: {
      autoSubmissionEnabled: false,
      requiresHumanApproval: true,
      credentialsHandling: "manual-only",
    },
  })
}