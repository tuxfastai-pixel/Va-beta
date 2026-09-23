import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest"

export async function POST(req: Request) {
  const authenticatedUser = await getSessionUser()

  if (!authenticatedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    userId?: string
    goal?: string
  } | null

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const requestedUserId = String(body.userId || "").trim()

  if (requestedUserId && requestedUserId !== authenticatedUser.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userId = authenticatedUser.userId
  const goal = String(body.goal || "").trim()

  if (!goal) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 })
  }

  const roadmapPrompt = `
Create a learning roadmap for someone who wants to become a ${goal}.

Return JSON format:

[
 { "skill": "...", "priority": 1 }
]
`

  const completion = await executeModelRequest({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a career planning assistant." },
      { role: "user", content: roadmapPrompt }
    ],
    telemetry: {
      route: "app/api/career/roadmap/route.ts",
      userId: userId || null,
    },
  })

  const rawRoadmap = extractTextFromCompletion(completion) || "[]"
  const parsedRoadmap = JSON.parse(rawRoadmap)

  await supabaseServer
    .from("career_paths")
    .insert({
      user_id: userId,
      career_goal: goal,
      roadmap: parsedRoadmap
    })

  return NextResponse.json({ roadmap: parsedRoadmap })
}
