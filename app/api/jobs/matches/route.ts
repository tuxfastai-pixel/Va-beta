import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { listCareerProfileRecords } from "@/lib/career/careerProfileStore.ts"
import {
  inferRolePayoutMethods,
  parseInternationalPaymentReadinessFromAnswers,
  recommendRolePaymentAction,
  scoreInternationalPaymentReadiness,
} from "@/lib/career/internationalPaymentReadiness.ts"
import { aggregateJobMatches } from "@/lib/jobs/jobAggregationEngine.ts"

export const dynamic = "force-dynamic"

type GuidanceItem = {
  id: string
  title: string
  detail: string
  priority: "high" | "medium"
}

type PaymentReadinessSummary = {
  score: number
  completed: string[]
  missing: string[]
  recommendation: string
  estimatedSetupMinutes: number
}

function buildEmployabilityGuidance(latest: NonNullable<Awaited<ReturnType<typeof listCareerProfileRecords>>[number]>): GuidanceItem[] {
  const intakeText = `${latest.intake.resumeText || ""} ${latest.intake.conversationText || ""}`.toLowerCase()
  const profile = latest.profile
  const guidance: GuidanceItem[] = []

  if (!intakeText.includes("linkedin") && !intakeText.includes("linkedin.com")) {
    guidance.push({
      id: "missing-linkedin",
      title: "Missing LinkedIn",
      detail: "Create or refresh a LinkedIn profile that mirrors your strongest role narrative and skills.",
      priority: "high",
    })
  }

  if (profile.sourceConfidence < 0.7 || profile.resumeSummary.trim().length < 80) {
    guidance.push({
      id: "incomplete-cv",
      title: "Incomplete CV",
      detail: "Strengthen your CV with measurable outcomes, role context, and clearer experience bullets.",
      priority: "high",
    })
  }

  if (!intakeText.includes("portfolio") && !intakeText.includes("behance") && !intakeText.includes("dribbble")) {
    guidance.push({
      id: "missing-portfolio",
      title: "Missing Portfolio",
      detail: "Add 2-3 work samples, case notes, or project screenshots to improve hiring confidence.",
      priority: "medium",
    })
  }

  const technicalSignals = ["developer", "engineering", "software", "frontend", "backend", "web", "data"]
  const appearsTechnical = technicalSignals.some((signal) =>
    profile.recommendedRoles.some((role) => role.toLowerCase().includes(signal)),
  )
  if (appearsTechnical && !intakeText.includes("github") && !intakeText.includes("gitlab")) {
    guidance.push({
      id: "missing-github",
      title: "Missing GitHub",
      detail: "Publish at least one clean project repository to validate technical execution.",
      priority: "medium",
    })
  }

  if (profile.profileConfidence < 0.6 || profile.overallReadiness < 0.62) {
    guidance.push({
      id: "interview-readiness",
      title: "Weak Interview Readiness",
      detail: "Run interview drills before applying to improve confidence, pacing, and response structure.",
      priority: "high",
    })
  }

  if (profile.internationalEmployabilityScore < 0.68 || profile.translatedSkills.length < 4) {
    guidance.push({
      id: "cert-opportunities",
      title: "Certification Opportunities",
      detail: "Target one short certification aligned to your top role to strengthen credibility.",
      priority: "medium",
    })
  }

  return guidance
}

function buildPaymentReadinessSummary(
  latest: NonNullable<Awaited<ReturnType<typeof listCareerProfileRecords>>[number]>,
): PaymentReadinessSummary {
  const paymentIntake = parseInternationalPaymentReadinessFromAnswers(
    latest.intake.answers,
  )
  const paymentProfile = scoreInternationalPaymentReadiness(paymentIntake)

  const firstMatch = latest.profile.recommendedRoles[0] || latest.profile.identityLayer?.targetTracks[0] || "remote work"
  const rolePaymentMethods = inferRolePayoutMethods({
    title: firstMatch,
    description: latest.profile.summary,
    location: latest.profile.workPreferences.international ? "Global" : "Remote",
  })
  const roleRecommendation = recommendRolePaymentAction({
    payoutMethods: rolePaymentMethods,
    readiness: paymentProfile,
  })

  return {
    score: paymentProfile.score,
    completed: paymentProfile.completed,
    missing: paymentProfile.missing,
    recommendation: `${roleRecommendation.summary} ${roleRecommendation.recommendedAction}`,
    estimatedSetupMinutes: roleRecommendation.estimatedSetupMinutes,
  }
}

export async function POST(req: NextRequest) {
  const authenticatedUser = await getSessionUser()

  if (!authenticatedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string }
  const requestedUserId = String(body.userId || "").trim()

  if (requestedUserId && requestedUserId !== authenticatedUser.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userId = authenticatedUser.userId

  const [latest] = await listCareerProfileRecords({
    userId: userId || null,
    limit: 1,
  })

  if (!latest) {
    return NextResponse.json({ error: "No career profile found. Run intake first." }, { status: 404 })
  }

  const matches = aggregateJobMatches(latest.profile)
  const profileImprovement = buildEmployabilityGuidance(latest)
  const paymentReadiness = buildPaymentReadinessSummary(latest)

  return NextResponse.json({
    profileId: latest.id,
    profileImprovement,
    paymentReadiness,
    matches,
    rules: {
      requiresHumanApproval: true,
      autoApplyEnabled: false,
      spamProtection: true,
    },
  })
}
