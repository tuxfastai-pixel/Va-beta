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
    const report = {
      goal: user.career_goal,
      summary: "Career progress improving",
      recommendation: "Learn Salesforce next"
    }

    await supabaseServer.from("reports").insert({
      user_id: user.id,
      content: report
    })
  }

  return NextResponse.json({ success: true })
}
