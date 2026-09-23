import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { parseJobDescription } from "@/lib/career/jobAssessment"

export const dynamic = "force-dynamic"

type Body = {
  title?: string
  description?: string
  url?: string
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

  const parsed = parseJobDescription({
    title: body.title,
    description,
  })

  return NextResponse.json({
    success: true,
    job: parsed,
    preparation: {
      tailoredCv: "Prepared from verified master profile.",
      coverLetter: `Prepared draft for ${parsed.title}.`,
      applicationAnswers: [
        "Why this role fits your verified experience",
        "How you will deliver in the first 30 days",
      ],
      interviewPreparation: [
        "Role-specific interview question set",
        "Behavioral answer framework",
      ],
      learningPlan: "Targeted sprint generated for skill gaps.",
      documentChecklist: [
        "Tailored CV",
        "Cover letter",
        "Portfolio evidence",
      ],
    },
    governance: {
      autoSubmissionEnabled: false,
      requiresHumanApproval: true,
      pilotPolicy: "Manual submission only during controlled pilot.",
      noPasswordSharing: true,
    },
  })
}