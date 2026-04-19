import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  buildPlatformStates,
  extractPlatformStatusesFromPlan,
  getPlatformSummary,
  normalizePlatformName,
  type PlatformName,
  type PlatformState,
  type PlatformStatus,
} from "@/lib/platforms/profileSync.ts";

type PlatformRow = {
  platform: string | null;
  status: string | null;
};

function mapRowsToPlatforms(rows: PlatformRow[] | null) {
  const statusByName: Partial<Record<PlatformName, PlatformStatus>> = {};

  for (const row of rows || []) {
    const normalizedPlatform = normalizePlatformName(row.platform);
    if (!normalizedPlatform) {
      continue;
    }

    statusByName[normalizedPlatform] = row.status === "completed" ? "completed" : "pending";
  }

  return buildPlatformStates(statusByName);
}

function isMissingUserPlatformsTable(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("user_platforms") && message.includes("could not find the table");
}

async function getPlatformPlanFallback(userId: string): Promise<PlatformState[]> {
  const { data } = await supabaseServer
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  const planValue = typeof data?.plan === "string" ? data.plan : null;
  return buildPlatformStates(extractPlatformStatusesFromPlan(planValue));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("user_platforms")
    .select("platform, status")
    .eq("user_id", userId);

  const platformRows = isMissingUserPlatformsTable(error)
    ? await getPlatformPlanFallback(userId)
    : mapRowsToPlatforms((data as PlatformRow[] | null) ?? null);
  const summary = getPlatformSummary(platformRows);

  return NextResponse.json({
    platforms: platformRows,
    ...summary,
    warning: error && !isMissingUserPlatformsTable(error) ? error.message : undefined,
    storage: isMissingUserPlatformsTable(error) ? "profiles_plan_fallback" : "user_platforms",
  });
}
