import { NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator/orchestrator";
import { buildUserContext, type ProfileRow } from "@/lib/orchestrator/userContext";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 5)));
  const autoApplyEnabled = searchParams.get("autoApply") === "true";
  const autonomousMode = searchParams.get("autonomous") !== "false";

  let query = supabaseServer
    .from("profiles")
    .select("*")
    .limit(limit);

  if (userId) {
    query = query.eq("id", userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles = (data || []) as ProfileRow[];
  const results = [];

  for (const profile of profiles) {
    const context = await buildUserContext(profile, { autoApplyEnabled, autonomousMode });
    const result = await runOrchestrator(context);
    results.push({ user_id: profile.id, ...result });
  }

  return NextResponse.json({
    success: true,
    usersProcessed: results.length,
    autoApplyEnabled,
    autonomousMode,
    results,
  });
}
