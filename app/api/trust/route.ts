import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { calculateTrust, getTrustScore } from "@/lib/users/trust";

type ReputationRow = {
  jobs_completed?: number | null;
};

export async function GET(req: Request) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  if (userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const trust = await getTrustScore(userId);

  if (trust.persisted) {
    return NextResponse.json(trust);
  }

  const { data: reputation, error: reputationError } = await supabaseServer
    .from("user_reputation")
    .select("jobs_completed")
    .eq("user_id", userId)
    .maybeSingle();

  if (reputationError) {
    return NextResponse.json({ error: reputationError.message }, { status: 500 });
  }

  const jobsCompleted = Number((reputation as ReputationRow | null)?.jobs_completed || 0);
  const level = calculateTrust({ jobs_completed: jobsCompleted, success_rate: 0 });

  return NextResponse.json({
    score: 0,
    level,
    jobs_completed: jobsCompleted,
    success_rate: 0,
    persisted: false,
  });
}
