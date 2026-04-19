import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET() {
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
