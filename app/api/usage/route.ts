import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser";
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const session = await getSessionUser();

  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await req.json()
  if (!userId || userId !== session.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase
    .from("monthly_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .maybeSingle()

  return NextResponse.json({
    tokensUsed: data?.total_tokens || 0
  })
}
