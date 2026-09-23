import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function POST(req: Request) {
  const session = await getSessionUser()

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { userId, answers } = await req.json()

  if (userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const goal = answers.goal

  await supabaseServer
    .from("users")
    .update({
      career_goal: goal
    })
    .eq("id", userId)

  return NextResponse.json({ success: true })
}
