import { NextRequest, NextResponse } from "next/server"
import { parseResumeInput } from "@/lib/career/resumeParser.ts"
import { normalizeResume } from "@/lib/career/resumeNormalizer.ts"
import { buildCareerIdentityProfile } from "@/lib/career/careerIdentityBuilder.ts"
import { reconstructResumeProfile } from "@/lib/career/resumeReconstruction.ts"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    resumeText?: string
    conversationText?: string
    preferences?: Record<string, unknown>
  }

  const parsed = parseResumeInput({ text: body.resumeText || "" })
  const normalized = normalizeResume(parsed)
  const profile = buildCareerIdentityProfile({
    intake: {
      userId: null,
      resumeText: body.resumeText || "",
      conversationText: body.conversationText || "",
      preferences: body.preferences as never,
    },
    normalizedResume: normalized,
  })

  const reconstruction = reconstructResumeProfile({
    profile,
    normalizedResume: normalized,
  })

  return NextResponse.json({ profile, reconstruction, warnings: parsed.warnings })
}
