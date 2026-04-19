import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export async function POST(req: Request) {
  const { userId, answers } = await req.json()

  const goal = answers.goal

  await supabaseServer
    .from("users")
    .update({
      career_goal: goal
    })
    .eq("id", userId)

  return NextResponse.json({ success: true })
}
