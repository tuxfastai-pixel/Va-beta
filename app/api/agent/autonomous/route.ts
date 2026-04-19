import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET() {
  const { data: users } = await supabaseServer
    .from("users")
    .select("*")

  for (const user of users || []) {
    const goal = user.career_goal

    if (!goal) continue

    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/gb/search/1?what=${encodeURIComponent(goal)}`)
    const jobs = await res.json()

    await supabaseServer.from("market_trends").insert({
      skill_name: goal,
      demand_score: jobs?.results?.length || 0,
      trend_direction: "rising"
    })
  }

  return NextResponse.json({ success: true })
}
