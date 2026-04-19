import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { enhanceWithAICapabilities } from "@/lib/profile/generateProfile.ts";
import { recordSkillPractice } from "@/lib/skills/progressEngine";
import {
  addPlatformCapabilityMarker,
  addPlatformMarkerToPlan,
  buildPlatformStates,
  extractPlatformStatusesFromCapabilities,
  extractPlatformStatusesFromPlan,
  getPlatformSummary,
  normalizePlatformName,
  stripPlatformCapabilityMarkers,
  type PlatformName,
  type PlatformState,
  type PlatformStatus,
} from "@/lib/platforms/profileSync.ts";

type CompleteRequest = {
  userId?: string;
  platform?: string;
};

type PlatformRow = {
  platform: string | null;
  status: string | null;
};

function mapRowsToPlatforms(rows: PlatformRow[] | null, fallbackPlatform?: PlatformName) {
  const statusByName: Partial<Record<PlatformName, PlatformStatus>> = {};

  if (fallbackPlatform) {
    statusByName[fallbackPlatform] = "completed";
  }

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

export async function POST(req: Request) {
  const body = (await req.json()) as CompleteRequest;
  const userId = body.userId;
  const platform = normalizePlatformName(body.platform);

  if (!userId || !platform) {
    return NextResponse.json({ error: "userId and platform are required" }, { status: 400 });
  }

  const { error: saveError } = await supabaseServer.from("user_platforms").upsert(
    {
      user_id: userId,
      platform,
      status: "completed",
    },
    {
      onConflict: "user_id,platform",
    }
  );

  const { data: profile } = await supabaseServer
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const hasAICapabilitiesColumn = Boolean(profile && Object.prototype.hasOwnProperty.call(profile, "ai_capabilities"));
  const currentCapabilities = hasAICapabilitiesColumn && Array.isArray((profile as { ai_capabilities?: unknown }).ai_capabilities)
    ? ((profile as { ai_capabilities?: unknown[] }).ai_capabilities || []).filter((item): item is string => typeof item === "string")
    : [];
  const visibleCapabilities = stripPlatformCapabilityMarkers(currentCapabilities);
  const currentPlan = typeof profile?.plan === "string" ? profile.plan : "free";

  const enhancedProfile = enhanceWithAICapabilities({
    ai_capabilities: visibleCapabilities,
    skills: [platform, "client communication", "automation"],
  });

  const nextCapabilities = hasAICapabilitiesColumn
    ? (isMissingUserPlatformsTable(saveError)
      ? addPlatformCapabilityMarker(enhancedProfile.ai_capabilities, platform)
      : enhancedProfile.ai_capabilities)
    : undefined;
  const nextPlan = isMissingUserPlatformsTable(saveError)
    ? addPlatformMarkerToPlan(currentPlan, platform)
    : currentPlan;

  let profileUpdateError: { message?: string } | null = null;

  if (profile) {
    const updates: Record<string, unknown> = {};

    if (isMissingUserPlatformsTable(saveError)) {
      updates.plan = nextPlan;
    }

    if (hasAICapabilitiesColumn && nextCapabilities) {
      updates.ai_capabilities = nextCapabilities;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseServer
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      profileUpdateError = error;
    }
  }

  let platformRows: PlatformState[];
  let statusWarning: string | undefined;
  let storage = "user_platforms";
  let persisted = !saveError;

  if (isMissingUserPlatformsTable(saveError)) {
    const statusByName = {
      ...extractPlatformStatusesFromPlan(nextPlan),
      ...extractPlatformStatusesFromCapabilities(nextCapabilities),
    };
    statusByName[platform] = "completed";
    platformRows = buildPlatformStates(statusByName);
    statusWarning = profileUpdateError?.message;
    storage = "profiles_plan_fallback";
    persisted = Boolean(profile) && !profileUpdateError;
  } else {
    const { data: rows, error: statusError } = await supabaseServer
      .from("user_platforms")
      .select("platform, status")
      .eq("user_id", userId);

    platformRows = mapRowsToPlatforms((rows as PlatformRow[] | null) ?? null, platform);
    statusWarning = statusError?.message || profileUpdateError?.message;
    persisted = !saveError && !profileUpdateError;
  }

  const summary = getPlatformSummary(platformRows);
  const pendingCount = Math.max(0, summary.totalCount - summary.completedCount);

  let skillProgressWarning: string | undefined;
  try {
    await recordSkillPractice({
      userId,
      skill: `${platform} onboarding`,
      usage: summary.nextStepUnlocked ? 10 : 4,
      aiSupported: true,
    });
  } catch (error) {
    skillProgressWarning = error instanceof Error ? error.message : "Failed to record skill progress.";
  }

  const message = summary.nextStepUnlocked
    ? `AI verified ${platform}. Your earning accounts are ready, so the next phase is now unlocked.`
    : `AI verified ${platform}. ${pendingCount} platform${pendingCount === 1 ? "" : "s"} left before full unlock.`;

  return NextResponse.json({
    verified: true,
    persisted,
    platform,
    platforms: platformRows,
    ...summary,
    message,
    warning:
      skillProgressWarning ||
      statusWarning ||
      (saveError && !isMissingUserPlatformsTable(saveError) ? saveError.message : undefined),
    storage,
  });
}
