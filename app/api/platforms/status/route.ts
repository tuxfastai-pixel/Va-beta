import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  buildPlatformStates,
  extractPlatformStatusesFromCapabilities,
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

function mergePlatformStates(...states: Partial<Record<PlatformName, PlatformStatus>>[]) {
  const merged: Partial<Record<PlatformName, PlatformStatus>> = {};

  for (const state of states) {
    for (const [name, status] of Object.entries(state) as Array<[PlatformName, PlatformStatus]>) {
      if (status === "completed") {
        merged[name] = "completed";
      } else if (!(name in merged)) {
        merged[name] = "pending";
      }
    }
  }

  return buildPlatformStates(merged);
}

function isMissingUserPlatformsTable(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("user_platforms") && message.includes("could not find the table");
}

async function getPlatformPlanFallback(userId: string): Promise<PlatformState[]> {
  const { data } = await supabaseServer
    .from("profiles")
    .select("plan, ai_capabilities")
    .eq("id", userId)
    .maybeSingle();

  const planValue = typeof data?.plan === "string" ? data.plan : null;
  const capabilities = Array.isArray(data?.ai_capabilities)
    ? data.ai_capabilities.filter((value): value is string => typeof value === "string")
    : [];

  return mergePlatformStates(
    extractPlatformStatusesFromPlan(planValue),
    extractPlatformStatusesFromCapabilities(capabilities)
  );
}

export async function GET(req: Request) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  if (userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseServer
    .from("user_platforms")
    .select("platform, status")
    .eq("user_id", userId);

  const rowsFromTable = isMissingUserPlatformsTable(error)
    ? buildPlatformStates()
    : mapRowsToPlatforms((data as PlatformRow[] | null) ?? null);
  const rowsFromProfile = await getPlatformPlanFallback(userId);
  const rowStatuses: Partial<Record<PlatformName, PlatformStatus>> = {};
  const profileStatuses: Partial<Record<PlatformName, PlatformStatus>> = {};

  for (const row of rowsFromTable) {
    rowStatuses[row.name] = row.status;
  }

  for (const row of rowsFromProfile) {
    profileStatuses[row.name] = row.status;
  }

  const platformRows = mergePlatformStates(rowStatuses, profileStatuses);
  const summary = getPlatformSummary(platformRows);

  return NextResponse.json({
    platforms: platformRows,
    ...summary,
    warning: error && !isMissingUserPlatformsTable(error) ? error.message : undefined,
    storage: isMissingUserPlatformsTable(error) ? "profiles_plan_fallback" : "user_platforms",
  });
}
