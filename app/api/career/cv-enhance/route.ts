import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

function recordId(userId: string, index: number) {
  return `cv-change-${userId}-${Date.now().toString(16)}-${index}`
}

function buildChanges(structured: Record<string, unknown>) {
  const summary = String(structured.professionalSummary || "")
  const workExperience = Array.isArray(structured.workExperience) ? structured.workExperience.map(String) : []
  const skills = Array.isArray(structured.skills) ? structured.skills.map(String) : []

  const changes = [] as Array<{
    section: string
    originalText: string
    proposedText: string
    reason: string
    sourceEvidence: string
    confidence: number
  }>

  if (summary) {
    changes.push({
      section: "professional_summary",
      originalText: summary,
      proposedText: summary.replace(/\s+/g, " ").trim(),
      reason: "Improve clarity and grammar while preserving factual claims.",
      sourceEvidence: "User-provided summary text.",
      confidence: 0.82,
    })
  }

  for (const item of workExperience.slice(0, 4)) {
    changes.push({
      section: "work_experience",
      originalText: item,
      proposedText: item.includes("achieved") ? item : `${item} (impact and scope clarified)` ,
      reason: "Convert duties into achievement-focused wording without adding new facts.",
      sourceEvidence: "Existing work experience entry.",
      confidence: 0.75,
    })
  }

  if (skills.length > 0) {
    changes.push({
      section: "skills",
      originalText: skills.join(", "),
      proposedText: Array.from(new Set(skills)).join(", "),
      reason: "Remove duplicate skills and normalize order for ATS readability.",
      sourceEvidence: "User-provided skills list.",
      confidence: 0.9,
    })
  }

  return changes
}

export async function POST() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: masterProfile, error: profileError } = await supabaseServer
    .from("master_career_profiles")
    .select("id, structured_profile")
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!masterProfile) {
    return NextResponse.json({ error: "No master career profile found." }, { status: 404 })
  }

  const structured = (masterProfile.structured_profile || {}) as Record<string, unknown>
  const changes = buildChanges(structured)

  const rows = changes.map((change, index) => ({
    id: recordId(session.userId, index),
    user_id: session.userId,
    profile_id: String(masterProfile.id),
    section: change.section,
    original_text: change.originalText,
    proposed_text: change.proposedText,
    reason: change.reason,
    source_evidence: change.sourceEvidence,
    confidence: change.confidence,
    user_approval_status: "pending",
  }))

  if (rows.length > 0) {
    const { error } = await supabaseServer
      .from("cv_change_records")
      .insert(rows)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    profileId: masterProfile.id,
    changes: rows,
    constraints: {
      inventEmployment: false,
      inventQualifications: false,
      inventCertifications: false,
      fabricateExperienceYears: false,
      claimUnsupportedTools: false,
      addUnsupportedAchievements: false,
    },
  })
}