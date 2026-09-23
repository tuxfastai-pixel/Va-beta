import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { listCareerProfileRecords } from "@/lib/career/careerProfileStore.ts"
import { normalizeJob } from "@/lib/jobs/jobNormalization.ts"
import { prepareApplicationArtifacts } from "@/lib/jobs/applicationPreparation.ts"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const authenticatedUser = await getSessionUser()

  if (!authenticatedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string
    job?: Record<string, unknown>
    action?: "ACCEPT" | "SKIP" | "SAVE_FOR_LATER" | "TRAIN_ME_FIRST"
  }

  const requestedUserId = String(body.userId || "").trim()

  if (requestedUserId && requestedUserId !== authenticatedUser.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userId = authenticatedUser.userId
  const action = body.action || "SAVE_FOR_LATER"

  if (!body.job) {
    return NextResponse.json({ error: "job payload is required" }, { status: 400 })
  }

  const [latest] = await listCareerProfileRecords({
    userId: userId || null,
    limit: 1,
  })

  if (!latest) {
    return NextResponse.json({ error: "No career profile found. Run intake first." }, { status: 404 })
  }

  const job = normalizeJob(body.job)
  const preview = prepareApplicationArtifacts({
    profile: latest.profile,
    reconstruction: latest.reconstruction,
    job,
    userName: userId || null,
  })

  const submissionAllowed = action === "ACCEPT"

  return NextResponse.json({
    action,
    submissionAllowed,
    governance: {
      requiresHumanApproval: true,
      reversible: true,
      explainable: true,
      observed: true,
      rateLimited: true,
      trustCalibrated: true,
    },
    preview,
  })
}
