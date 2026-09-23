import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(req: Request) {
  const session = await getSessionUser()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  if (userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: skills } = await supabaseServer
    .from("skill_progress")
    .select("progress")
    .eq("user_id", userId)

  const progress = (skills || []).reduce((sum, skill) => sum + (skill.progress || 0), 0)
  const score = Math.min(100, progress)

  return NextResponse.json({ score })
}
