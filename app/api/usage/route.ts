import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await req.json()

  const { data } = await supabase
    .from("monthly_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .maybeSingle()

  return NextResponse.json({
    tokensUsed: data?.total_tokens || 0
  })
}
