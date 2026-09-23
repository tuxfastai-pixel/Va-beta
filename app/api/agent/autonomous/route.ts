import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return NextResponse.json(
      { success: false, error: "Automation authentication is not configured" },
      { status: 503 }
    )
  }

  const authorization = request.headers.get("authorization")

  if (authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }
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
