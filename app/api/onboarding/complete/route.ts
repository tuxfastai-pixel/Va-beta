import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { appendCareerProfileRecord, listCareerProfileRecords } from "@/lib/career/careerProfileStore.ts"
import { buildCareerIdentityProfile } from "@/lib/career/careerIdentityBuilder.ts"
import { reconstructResumeProfile } from "@/lib/career/resumeReconstruction.ts"
import { buildContinuityCheckpoint, clampPercent, type OnboardingProgressPayload } from "@/lib/career/activationContinuity"
import type { CareerIdentityProfile, CareerReconstructionOutput } from "@/lib/career/careerTypes.ts"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

type CompleteBody = {
  userId?: string
  name?: string
  email?: string
  selectedCareers?: string[]
  primaryCareer?: string
  secondaryCareers?: string[]
  selectedAccounts?: string[]
  accountHolderName?: string
  accountEmail?: string
  payoutCurrency?: string
}

function isMissingCareerActivationTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes("career_activation_states") && message.includes("could not find the table")
}

function buildFallbackProfile(body: CompleteBody): CareerIdentityProfile {
  const careerTracks = Array.from(
    new Set(
      [
        String(body.primaryCareer || "").trim(),
        ...(Array.isArray(body.secondaryCareers) ? body.secondaryCareers : []),
        ...(Array.isArray(body.selectedCareers) ? body.selectedCareers : []),
      ].filter(Boolean),
    ),
  )

  return buildCareerIdentityProfile({
    intake: {
      userId: body.userId || null,
      conversationText: `Name: ${body.name || ""}. Email: ${body.email || ""}. Career strategy: ${careerTracks.join(", ")}. Preferred payout currency: ${body.payoutCurrency || "USD"}.`,
      answers: {
        existingAccounts: Array.isArray(body.selectedAccounts) ? body.selectedAccounts : [],
        accountHolderName: body.accountHolderName || "",
        accountEmail: body.accountEmail || "",
        preferredPayoutCurrency: body.payoutCurrency || "USD",
        careerTracks,
      },
      preferences: {
        remote: true,
        international: true,
        quietMode: false,
      },
    },
    normalizedResume: {
      cleanText: `${body.name || ""} ${careerTracks.join(" ")}`.trim(),
      bulletPoints: careerTracks.length > 0 ? careerTracks.map((career) => `Target track: ${career}`) : ["Target track pending"],
      keywordHints: careerTracks,
      skillSignals: careerTracks,
      experienceSignals: careerTracks,
      confidence: 0.45,
    },
  })
}

function buildFallbackReconstruction(profile: CareerIdentityProfile): CareerReconstructionOutput {
  return {
    atsCv: profile.summary,
    remoteReadyCv: profile.summary,
    shortBio: profile.summary,
    linkedinSummary: profile.summary,
    skillsMatrix: profile.translatedSkills.map((skill) => ({ skill, evidence: 0.55, roleFit: 0.55 })),
    internationalEmployabilityScore: profile.internationalEmployabilityScore,
    confidenceProfile: `Overall readiness ${Math.round(profile.overallReadiness * 100)}%`,
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as CompleteBody
  const userId = session.userId

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const existing = await listCareerProfileRecords({ userId, limit: 1 })

  const profile = buildFallbackProfile(body)
  const reconstruction = buildFallbackReconstruction(profile)

  const readinessPayload: OnboardingProgressPayload = {
    name: String(body.name || "").trim() || "Pilot User",
    email: String(body.email || "").trim().toLowerCase() || session.email || "",
    skillTrack: "activation",
    selectedCareers: Array.isArray(body.selectedCareers) ? body.selectedCareers : [],
    primaryCareer: String(body.primaryCareer || "").trim(),
    secondaryCareers: Array.isArray(body.secondaryCareers) ? body.secondaryCareers : [],
    paymentReadiness: {
      selectedAccounts: Array.isArray(body.selectedAccounts) ? body.selectedAccounts : [],
      accountHolderName: String(body.accountHolderName || "").trim(),
      accountEmail: String(body.accountEmail || "").trim(),
      payoutCurrency: String(body.payoutCurrency || "USD"),
      paymentReadinessScore: clampPercent((Array.isArray(body.selectedAccounts) ? body.selectedAccounts.length : 0) * 25 + (body.accountEmail ? 25 : 0)),
      paymentMissing: [
        Array.isArray(body.selectedAccounts) && body.selectedAccounts.length > 0 ? null : "payment_account",
        body.accountEmail ? null : "account_email",
      ].filter((item): item is string => Boolean(item)),
    },
    internationalReadiness: {
      remoteReadinessScore: 70,
      profileCompletionScore: 80,
      internationalReadinessScore: 72,
    },
  }

  const checkpoint = buildContinuityCheckpoint({
    userId,
    completedStep: 5,
    payload: readinessPayload,
  })

  const record = existing[0]
    ? existing[0]
    : await appendCareerProfileRecord({
        userId,
        intake: {
          userId,
          conversationText: `Onboarding completed by ${body.name || body.email || "pilot user"}.`,
          answers: {
            selectedCareers: Array.isArray(body.selectedCareers) ? body.selectedCareers : [],
            primaryCareer: body.primaryCareer || "",
            secondaryCareers: Array.isArray(body.secondaryCareers) ? body.secondaryCareers : [],
            selectedAccounts: Array.isArray(body.selectedAccounts) ? body.selectedAccounts : [],
            accountHolderName: body.accountHolderName || "",
            accountEmail: body.accountEmail || "",
            preferredPayoutCurrency: body.payoutCurrency || "USD",
          },
          preferences: {
            remote: true,
            international: true,
          },
        },
        profile,
        reconstruction,
      })

  const { error: activationStateError } = await supabaseServer
    .from("career_activation_states")
    .upsert(
      {
        user_id: userId,
        onboarding_completed: true,
        completed_step: 5,
        last_valid_step: 5,
        completion_timestamp: checkpoint.completionTimestamp,
        answers: readinessPayload,
        career_lanes: checkpoint.careerLanes,
        payment_readiness: checkpoint.paymentReadiness,
        international_readiness: checkpoint.internationalReadiness,
        continuity_checkpoint: checkpoint,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

  if (activationStateError && !isMissingCareerActivationTable(activationStateError)) {
    return NextResponse.json({ error: activationStateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    id: record.id,
    existing: Boolean(existing[0]),
    onboardingCompleted: true,
    redirectTo: "/client-portal",
  })
}