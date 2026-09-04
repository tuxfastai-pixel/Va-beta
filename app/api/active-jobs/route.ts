import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const session = await getSessionUser();

  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("active_jobs")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
