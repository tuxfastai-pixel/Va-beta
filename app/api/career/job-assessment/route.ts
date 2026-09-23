import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import { assessJobFit, parseJobDescription } from "@/lib/career/jobAssessment"
import { updateJourneyReferences } from "@/lib/career/careerJourneyService"

export const dynamic = "force-dynamic"

type JsonRecord = Record<string, unknown>

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

function responseFromRow(row: JsonRecord) {
  const source = (row.source_job || {}) as JsonRecord
  const assessment = (row.assessment || {}) as JsonRecord

  return {
    assessmentId: String(row.id || ""),
    jobTitle: String(source.title || "Selected role"),
    jobCompany: String(source.company || ""),
    matchScore: Number(assessment.matchScore ?? 0),
    matchExplanation: String(assessment.matchExplanation || ""),
    strengths: asStrings(assessment.strengths),
    transferableStrengths: asStrings(assessment.transferableStrengths),
    missingSkills: asStrings(assessment.missingSkills),
    scoreBreakdown: (assessment.scoreBreakdown || {}) as JsonRecord,
    recommendationBand: String(assessment.recommendationBand || ""),
  }
}

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabaseServer
      .from("job_application_versions")
      .select("id,source_job,assessment")
      .eq("user_id", session.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "Choose a recommended job or paste a job description before assessment.",
          code: "job_required",
        },
        { status: 404 }
      )
    }

    return NextResponse.json(responseFromRow(data as JsonRecord))
  } catch (error) {
    console.error("job-assessment GET error:", error)
    return NextResponse.json({ error: "Could not load the job assessment." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as JsonRecord
    let title = String(body.title || "").trim()
    let company = String(body.company || "").trim()
    let description = String(body.description || "").trim()
    const jobId = String(body.jobId || "").trim()

    if (jobId) {
      const { data: job, error: jobError } = await supabaseServer
        .from("jobs")
        .select("id,title,company,description")
        .eq("id", jobId)
        .eq("user_id", session.userId)
        .maybeSingle()

      if (jobError) {
        return NextResponse.json({ error: jobError.message }, { status: 500 })
      }
      if (!job) {
        return NextResponse.json({ error: "The selected job could not be found." }, { status: 404 })
      }

      title = String(job.title || "").trim()
      company = String(job.company || "").trim()
      description = String(job.description || "").trim()
    }

    if (!title || description.length < 40) {
      return NextResponse.json(
        { error: "Add a job title and at least 40 characters from the job description." },
        { status: 400 }
      )
    }

    const [profileResult, activationResult] = await Promise.all([
      supabaseServer
        .from("master_career_profiles")
        .select("structured_profile")
        .eq("user_id", session.userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseServer
        .from("career_activation_states")
        .select("payment_readiness")
        .eq("user_id", session.userId)
        .maybeSingle(),
    ])

    if (profileResult.error) {
      return NextResponse.json({ error: profileResult.error.message }, { status: 500 })
    }
    if (!profileResult.data) {
      return NextResponse.json({ error: "Complete your CV profile before assessing a job." }, { status: 409 })
    }

    const structured = (profileResult.data.structured_profile || {}) as JsonRecord
    const skills = asStrings(structured.skills)
    const pendingSkills = Array.isArray(structured.skillsNeedingConfirmation)
      ? structured.skillsNeedingConfirmation
          .map((item) => typeof item === "object" && item !== null ? String((item as JsonRecord).skill || "").trim() : "")
          .filter(Boolean)
      : []

    const parsedJob = parseJobDescription({ title, description })
    if (parsedJob.requiredSkills.length === 0) {
      return NextResponse.json(
        {
          error:
            "The job description does not contain enough recognisable skill requirements. Paste the full responsibilities and requirements section.",
        },
        { status: 422 }
      )
    }

    const payment = (activationResult.data?.payment_readiness || {}) as JsonRecord
    const fit = assessJobFit({
      parsedJob,
      profile: {
        translatedSkills: skills,
        hiddenSkills: pendingSkills,
        profileConfidence: skills.length >= 5 ? 0.85 : skills.length > 0 ? 0.65 : 0.35,
        internationalPaymentReadinessScore: Number(payment.paymentReadinessScore ?? 50),
        evidenceText: [
          ...asStrings(structured.workExperience),
          ...asStrings(structured.projects),
          ...asStrings(structured.achievements),
          ...asStrings(structured.certifications),
        ],
      },
    })

    const strengths = fit.verifiedSkills
    const transferableStrengths = fit.transferableSkills

    const sourceJob = {
      id: jobId || null,
      title,
      company: company || null,
      description,
      source: jobId ? "recommended" : "manual",
    }
    const assessment = {
      matchScore: fit.scores.matchScore,
      matchExplanation:
        strengths.length + transferableStrengths.length > 0
          ? `Your profile directly matches ${strengths.length} and supports ${transferableStrengths.length} transferable match${transferableStrengths.length === 1 ? "" : "es"} across ${parsedJob.requiredSkills.length} recognised required skills. Review the evidence and gaps before applying.`
          : "No evidence-backed match was found yet. Review the listed gaps and add evidence to your profile before applying.",
      strengths,
      transferableStrengths,
      missingSkills: fit.missingSkills,
      scoreBreakdown: fit.scores,
      recommendationBand: fit.band,
      riskFlags: fit.riskFlags,
      assessedAt: new Date().toISOString(),
    }

    const fingerprint = [
      title.toLowerCase(),
      (company || "unknown").toLowerCase(),
      description.toLowerCase().replace(/\s+/g, " ").slice(0, 180),
    ].join("|")

    const recordId = `job-assessment-${session.userId}-${Date.now().toString(16)}`
    const { data: saved, error: saveError } = await supabaseServer
      .from("job_application_versions")
      .insert({
        id: recordId,
        user_id: session.userId,
        job_fingerprint: fingerprint,
        source_job: sourceJob,
        assessment,
        tailored_cv: {},
        application_status: "assessed",
        updated_at: new Date().toISOString(),
      })
      .select("id,source_job,assessment")
      .single()

    if (saveError || !saved) {
      return NextResponse.json({ error: saveError?.message || "Could not save assessment." }, { status: 500 })
    }

    await updateJourneyReferences(session.userId, {
      jobId: jobId || fingerprint,
      assessmentId: recordId,
    })

    return NextResponse.json(responseFromRow(saved as JsonRecord), { status: 201 })
  } catch (error) {
    console.error("job-assessment POST error:", error)
    return NextResponse.json({ error: "Could not assess this job." }, { status: 500 })
  }
}
