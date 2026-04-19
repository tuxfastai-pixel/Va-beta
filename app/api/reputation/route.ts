import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { calculateTrust, getTrustScore } from "@/lib/users/trust";

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("user_reputation")
    .select("score, reputation_score, jobs_completed")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobsCompleted = Number(data?.jobs_completed || 0);
  const trust = await getTrustScore(userId);

  return NextResponse.json({
    score: Number(data?.score ?? data?.reputation_score ?? 50),
    jobs_completed: jobsCompleted,
    trust_score: Number(trust.score || 0),
    trust_level: trust.level || calculateTrust({ jobs_completed: jobsCompleted, success_rate: 0 }),
    success_rate: Number(trust.success_rate || 0),
  });
}
