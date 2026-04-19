import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  const { data: skills } = await supabaseServer
    .from("skill_progress")
    .select("progress")
    .eq("user_id", userId)

  const progress = (skills || []).reduce((sum, skill) => sum + (skill.progress || 0), 0)
  const score = Math.min(100, progress)

  return NextResponse.json({ score })
}
