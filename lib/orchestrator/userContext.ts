import { extractPlatformStatusesFromPlan } from "@/lib/platforms/profileSync";
import { supabaseServer } from "@/lib/supabaseServer";
import { getTrustScore } from "@/lib/users/trust";

export type ProfileRow = {
  id: string;
  plan?: string | null;
  ai_capabilities?: unknown;
  interests?: string[] | string | null;
  desired_income?: number | string | null;
  experience_summary?: string | null;
  location?: string | null;
  platform_targets?: string[] | string | null;
  system_paused?: boolean | null;
  safe_mode?: boolean | null;
  careers?: string[] | null;
  primary_career?: string | null;
  secondary_careers?: string[] | null;
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

  const careers = Array.isArray(profile.careers)
    ? profile.careers.filter((career): career is string => typeof career === "string" && career.trim().length > 0)
    : [];

  const primaryCareer = String(profile.primary_career || "").trim() || careers[0] || null;
  const secondaryCareers = Array.isArray(profile.secondary_careers)
    ? profile.secondary_careers.filter((career): career is string => typeof career === "string" && career.trim().length > 0)
    : careers.slice(1);

  const interests = Array.isArray(profile.interests)
    ? profile.interests.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : String(profile.interests || "")
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const platformTargets = Array.isArray(profile.platform_targets)
    ? profile.platform_targets.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : String(profile.platform_targets || "")
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);

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
    careers: primaryCareer ? Array.from(new Set([primaryCareer, ...secondaryCareers])) : careers,
    primary_career: primaryCareer,
    secondary_careers: secondaryCareers,
    interests,
    desired_income: Number(profile.desired_income || 0) || undefined,
    experience_summary: String(profile.experience_summary || "").trim() || undefined,
    location: String(profile.location || "").trim() || undefined,
    platform_targets: platformTargets,
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
