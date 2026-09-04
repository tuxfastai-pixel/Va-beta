import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { listCareerProfileRecords } from "@/lib/career/careerProfileStore.ts"
import { normalizeJob } from "@/lib/jobs/jobNormalization.ts"
import { buildInterviewPreparation } from "@/lib/jobs/interviewPreparationEngine.ts"
import { runInterviewSimulation } from "@/lib/interview/interviewSimulation.ts"
import { getAdaptiveInterviewCoaching } from "@/lib/interview/adaptiveInterviewCoach.ts"
import { buildWorkContinuityPlan } from "@/lib/workflow/workContinuityAssistant.ts"
import { assessBurnoutRisk } from "@/lib/workflow/burnoutPrevention.ts"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const authenticatedUser = await getSessionUser()

  if (!authenticatedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string
    role?: string
    job?: Record<string, unknown>
    fatigueRisk?: number
    anxietyLevel?: number
  }

  const requestedUserId = String(body.userId || "").trim()

  if (requestedUserId && requestedUserId !== authenticatedUser.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userId = authenticatedUser.userId
  const role = String(body.role || "General interview")

  const [latest] = await listCareerProfileRecords({
    userId: userId || null,
    limit: 1,
  })

  if (!latest) {
    return NextResponse.json({ error: "No career profile found. Run intake first." }, { status: 404 })
  }

  const job = body.job ? normalizeJob(body.job) : normalizeJob({ title: role, company: "Target employer", location: "Remote" })
  const prep = buildInterviewPreparation({
    profile: latest.profile,
    job,
  })

  const simulation = runInterviewSimulation({
    profile: latest.profile,
    role,
  })

  const coaching = getAdaptiveInterviewCoaching({
    profile: latest.profile,
    fatigueRisk: body.fatigueRisk,
    anxietyLevel: body.anxietyLevel,
  })

  const continuity = buildWorkContinuityPlan({
    role,
    workloadLevel: latest.profile.workPreferences.pacingPreference === "slow" ? "low" : "medium",
    timezone: latest.profile.workPreferences.timezoneFlexibility,
  })

  const burnout = assessBurnoutRisk({
    workloadIntensity: latest.profile.workPreferences.pacingPreference === "fast" ? 0.7 : 0.45,
    interruptionRate: latest.profile.workPreferences.quietMode ? 0.25 : 0.45,
    recoveryScore: latest.profile.overallReadiness,
    trustStability: latest.profile.profileConfidence,
  })

  return NextResponse.json({
    prep,
    simulation,
    coaching,
    continuity,
    burnout,
  })
}
