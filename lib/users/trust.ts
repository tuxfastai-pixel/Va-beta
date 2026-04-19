import { supabaseServer } from "@/lib/supabaseServer";

export type TrustLevel = "new" | "verified" | "trusted" | "elite";

export type TrustStats = {
  jobs_completed?: number | null;
  success_rate?: number | null;
};

function normalizeSuccessRate(value: number | null | undefined) {
  const numericValue = Number(value || 0);
  if (numericValue > 1) {
    return Math.max(0, Math.min(1, numericValue / 100));
  }

  return Math.max(0, Math.min(1, numericValue));
}

function isMissingTrustTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("user_trust_scores") && message.includes("could not find the table");
}

export function calculateTrust(userStats: TrustStats): TrustLevel {
  const jobsCompleted = Math.max(0, Number(userStats.jobs_completed || 0));
  const successRate = normalizeSuccessRate(userStats.success_rate);
  const score = (jobsCompleted * 5) + (successRate * 50);

  if (score > 500) return "elite";
  if (score > 200) return "trusted";
  if (score > 50) return "verified";
  return "new";
}

export async function upsertTrustScore(userId: string, userStats: TrustStats) {
  const jobsCompleted = Math.max(0, Number(userStats.jobs_completed || 0));
  const successRate = normalizeSuccessRate(userStats.success_rate);
  const score = Math.round((jobsCompleted * 5) + (successRate * 50));
  const level = calculateTrust({ jobs_completed: jobsCompleted, success_rate: successRate });

  const { error } = await supabaseServer
    .from("user_trust_scores")
    .upsert(
      {
        user_id: userId,
        score,
        level,
        jobs_completed: jobsCompleted,
        success_rate: successRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error && !isMissingTrustTable(error)) {
    throw new Error(`Failed to upsert trust score for ${userId}: ${error.message}`);
  }

  return {
    user_id: userId,
    score,
    level,
    jobs_completed: jobsCompleted,
    success_rate: successRate,
    persisted: !error,
  };
}

export async function getTrustScore(userId: string) {
  const { data, error } = await supabaseServer
    .from("user_trust_scores")
    .select("score, level, jobs_completed, success_rate")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingTrustTable(error)) {
    throw new Error(`Failed to load trust score for ${userId}: ${error.message}`);
  }

  if (!data || error) {
    return {
      score: 0,
      level: "new" as TrustLevel,
      jobs_completed: 0,
      success_rate: 0,
      persisted: false,
    };
  }

  return {
    score: Number(data.score || 0),
    level: calculateTrust({
      jobs_completed: Number(data.jobs_completed || 0),
      success_rate: Number(data.success_rate || 0),
    }),
    jobs_completed: Number(data.jobs_completed || 0),
    success_rate: normalizeSuccessRate(Number(data.success_rate || 0)),
    persisted: true,
  };
}
