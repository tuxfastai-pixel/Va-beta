import { NextRequest, NextResponse } from "next/server"
import { parseResumeInput } from "@/lib/career/resumeParser.ts"
import { normalizeResume } from "@/lib/career/resumeNormalizer.ts"
import { buildCareerIdentityProfile } from "@/lib/career/careerIdentityBuilder.ts"
import { reconstructResumeProfile } from "@/lib/career/resumeReconstruction.ts"
import { appendCareerProfileRecord } from "@/lib/career/careerProfileStore.ts"
import { buildAdaptiveCareerQuestions } from "@/lib/career/adaptiveQuestionFlow.ts"

export const dynamic = "force-dynamic"

type ProfileBody = {
  userId?: string
  resumeText?: string
  resumeFileName?: string
  conversationText?: string
  answers?: Record<string, string | boolean | string[] | number | null>
  preferences?: {
    remote?: boolean
    hybrid?: boolean
    international?: boolean
    contract?: boolean
    fullTime?: boolean
    timezoneFlexibility?: "local" | "regional" | "global"
    pacingPreference?: "slow" | "balanced" | "fast"
    quietMode?: boolean
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ProfileBody

  const parsedResume = parseResumeInput({
    text: body.resumeText || "",
    fileName: body.resumeFileName || null,
    mimeType: "text/plain",
  })

  const normalized = normalizeResume(parsedResume)
  const profile = buildCareerIdentityProfile({
    intake: {
      userId: body.userId || null,
      resumeText: body.resumeText || "",
      resumeFileName: body.resumeFileName || null,
      conversationText: body.conversationText || "",
      answers: body.answers || {},
      preferences: body.preferences || {},
    },
    normalizedResume: normalized,
  })

  const reconstruction = reconstructResumeProfile({
    profile,
    normalizedResume: normalized,
  })

  const questions = buildAdaptiveCareerQuestions({
    hasResume: Boolean(body.resumeText?.trim()),
    hasConversation: Boolean(body.conversationText?.trim()),
    hasPreferences: Boolean(body.preferences && Object.keys(body.preferences).length > 0),
    fatigueRisk: profile.workPreferences.pacingPreference === "slow" ? 0.65 : 0.35,
  })

  const record = await appendCareerProfileRecord({
    userId: profile.userId,
    intake: {
      userId: profile.userId,
      resumeText: body.resumeText || "",
      resumeFileName: body.resumeFileName || null,
      conversationText: body.conversationText || "",
      answers: body.answers || {},
      preferences: body.preferences || {},
    },
    profile,
    reconstruction,
  })

  return NextResponse.json({
    id: record.id,
    profile,
    reconstruction,
    questions,
    warnings: parsedResume.warnings,
  })
}
