import { extractPlatformStatusesFromPlan } from "@/lib/platforms/profileSync";
import { supabaseServer } from "@/lib/supabaseServer";
import { getTrustScore } from "@/lib/users/trust";

export type ProfileRow = {
  id: string;
  plan?: string | null;
  ai_capabilities?: unknown;
  system_paused?: boolean | null;
  safe_mode?: boolean | null;
};

async function safeLoad(table: string, userId: string, filterColumn = "user_id") {
  const { data, error } = await supabaseServer
    .from(table)
    .select("*")
    .eq(filterColumn, userId)
    .limit(20);

  if (error) {
    return [];
  }

  return data || [];
}

export async function buildUserContext(profile: ProfileRow, options: { autoApplyEnabled: boolean; autonomousMode: boolean }) {
  const userId = profile.id;
  const planValue = typeof profile.plan === "string" ? profile.plan : null;
  const platformsCompletedCount = Object.keys(extractPlatformStatusesFromPlan(planValue)).length;
  const profileReady = Array.isArray(profile.ai_capabilities)
    ? profile.ai_capabilities.length > 0
    : Boolean(planValue);

  const [jobQueue, proposalQueue, activeClients, activeWork] = await Promise.all([
    safeLoad("job_matches", userId),
    safeLoad("job_applications", userId),
    safeLoad("deals", userId),
    safeLoad("active_jobs", userId),
  ]);

  const trust = await getTrustScore(userId);
  const trusted = ["trusted", "elite"].includes(String(trust.level || "new"));

  return {
    id: userId,
    plan: planValue,
    platformsCompleted: platformsCompletedCount,
    profileReady,
    job_queue: jobQueue,
    pendingProposals: proposalQueue,
    activeClients,
    activeWork,
    autoApplyEnabled: trusted ? options.autoApplyEnabled : false,
    autonomous_mode: options.autonomousMode,
    trusted,
    system_paused: Boolean(profile.system_paused ?? false),
    safe_mode: Boolean(profile.safe_mode ?? true),
    allowAutoSendMessages: !Boolean(profile.safe_mode ?? true),
  };
}

export async function getUser(userId: string, options: { autoApplyEnabled: boolean; autonomousMode: boolean }) {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return await buildUserContext(data as ProfileRow, options);
}

export async function getAllActiveUsers(limit = 50, options: { autoApplyEnabled: boolean; autonomousMode: boolean }) {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("*")
    .limit(limit);

  if (error) {
    return [];
  }

  return await Promise.all(
    ((data || []) as ProfileRow[]).map((profile) => buildUserContext(profile, options))
  );
}
