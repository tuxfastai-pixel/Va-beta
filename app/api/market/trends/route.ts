import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET() {

  const { data: users } = await supabaseServer
    .from("users")
    .select("*")

  if (!users) {
    return NextResponse.json({ success: false })
  }

  for (const user of users) {

    const goal = user.career_goal

    if (!goal) continue

    const jobRes = await fetch(
      `https://api.adzuna.com/v1/api/jobs/gb/search/1?what=${encodeURIComponent(goal)}`
    )

    const jobs = await jobRes.json()

    const demandScore = jobs?.results?.length || 0

    await supabaseServer.from("market_trends").insert({
      skill_name: goal,
      demand_score: demandScore,
      trend_direction: demandScore > 50 ? "rising" : "stable"
    })

  }

  return NextResponse.json({ success: true })
}
