import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest"

export async function POST(req: Request) {
  const session = await getSessionUser()

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { userId, message } = await req.json()

  if (userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const completion = await executeModelRequest({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Extract important long-term facts about the user in one sentence."
      },
      { role: "user", content: message }
    ],
    telemetry: {
      route: "app/api/memory/store/route.ts",
      userId: userId || null,
    },
  })

  const memory = extractTextFromCompletion(completion)

  await supabaseServer.from("ai_memory").insert({
    user_id: userId,
    content: memory,
    memory_type: "career"
  })

  return NextResponse.json({ success: true })
}
