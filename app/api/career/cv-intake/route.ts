import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import {
  buildCvFromOnboardingAnswers,
  mergeSkillExtraction,
  structureCvInput,
  type CvInputMode,
} from "@/lib/career/cvIntake"
import {
  extractSkillsFromCv,
} from "@/lib/career/cvSkillExtraction"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

type IntakeBody = {
  mode?: CvInputMode
  text?: string
  fileName?: string
}

function profileIdFor(userId: string) {
  return `master-${userId}`
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as IntakeBody
  const mode: CvInputMode = body.mode || "continue_without_cv"

  const { data: activation } = await supabaseServer
    .from("career_activation_states")
    .select("answers, career_lanes, payment_readiness, international_readiness")
    .eq("user_id", session.userId)
    .maybeSingle()

  const onboardingAnswers = (activation?.answers || {}) as {
    name?: string
    email?: string
    skillTrack?: string
    selectedCareers?: string[]
  }

  let text = String(body.text || "").trim()
  if (mode === "build_from_onboarding") {
    text = buildCvFromOnboardingAnswers({
      name: onboardingAnswers.name || "Pilot User",
      email: onboardingAnswers.email || session.email || "",
      selectedCareers: onboardingAnswers.selectedCareers || [],
      skillTrack: onboardingAnswers.skillTrack || "activation",
      summary: "Career profile generated from verified onboarding responses.",
    })
  }

  let structured = structureCvInput({
    mode,
    rawText: text,
    onboardingFallback: {
      name: onboardingAnswers.name,
      email: onboardingAnswers.email || session.email,
      selectedCareers: onboardingAnswers.selectedCareers || [],
      paymentReadiness: Number((activation?.payment_readiness as { paymentReadinessScore?: number } | null)?.paymentReadinessScore || 50),
      remoteReadiness: Number((activation?.international_readiness as { remoteReadinessScore?: number } | null)?.remoteReadinessScore || 60),
    },
  })

  if (
    text &&
    (
      mode === "upload" ||
      mode === "paste"
    )
  ) {
    try {
      const extraction =
        await extractSkillsFromCv({
          rawText: text,
          userId: session.userId,
        })

      structured =
        mergeSkillExtraction(
          structured,
          extraction
        )
    } catch (error) {
      console.error(
        "CV skill extraction failed:",
        error instanceof Error
          ? error.message
          : "Unknown extraction error"
      )
    }
  }

  const profileId = profileIdFor(session.userId)
  const payload = {
    id: profileId,
    user_id: session.userId,
    source_type: mode,
    source_payload: {
      fileName: body.fileName || null,
      mode,
      textLength: text.length,
    },
    structured_profile: structured,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseServer
    .from("master_career_profiles")
    .upsert(payload, { onConflict: "id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    profileId,
    structured,
    nextStage: "ai_profile_review",
  })
}