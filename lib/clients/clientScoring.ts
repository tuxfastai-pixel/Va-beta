import { supabaseServer } from "@/lib/supabaseServer";

export type ScoreTier = "vip" | "high" | "medium" | "low";

export interface ClientScoreInput {
  lifetime_value?: number;
  jobs_completed?: number;
  avg_response_time?: number;
  message_count?: number;
  retention_probability?: number;
}

/**
 * Calculate client score (0–100)
 * Higher score = more valuable, more attention
 */
export function calculateClientScore(client: ClientScoreInput): number {
  let score = 0;

  // 💰 Payment / lifetime value (max 40 pts)
  const ltv = Number(client.lifetime_value || 0);
  if (ltv > 1000) score += 40;
  else if (ltv > 500) score += 30;
  else if (ltv > 300) score += 20;
  else if (ltv > 100) score += 10;

  // 🔁 Repeat business (max 20 pts)
  const jobs = Number(client.jobs_completed || 0);
  if (jobs > 5) score += 20;
  else if (jobs > 2) score += 12;
  else if (jobs > 0) score += 5;

  // ⚡ Responsiveness — hours to reply (max 15 pts)
  const responseHours = Number(client.avg_response_time || 0);
  if (responseHours > 0 && responseHours < 4) score += 15;
  else if (responseHours < 12) score += 10;
  else if (responseHours < 24) score += 5;

  // 💬 Engagement / message count (max 10 pts)
  const msgs = Number(client.message_count || 0);
  if (msgs > 20) score += 10;
  else if (msgs > 10) score += 6;
  else if (msgs > 3) score += 3;

  // 🔒 Retention likelihood (max 15 pts)
  const retention = Number(client.retention_probability || 0);
  if (retention > 0.8) score += 15;
  else if (retention > 0.6) score += 10;
  else if (retention > 0.4) score += 5;

  return Math.min(100, score);
}

/**
 * Determine tier label from score
 */
export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return "vip";
  if (score >= 50) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * Estimate retention probability from interaction patterns
 */
export function estimateRetentionProbability(client: {
  jobs_completed?: number;
  message_count?: number;
  lifetime_value?: number;
  avg_response_time?: number;
}): number {
  let score = 0;
  const max = 4;

  if (Number(client.jobs_completed || 0) > 2) score += 1;
  if (Number(client.message_count || 0) > 5) score += 1;
  if (Number(client.lifetime_value || 0) > 200) score += 1;
  if (Number(client.avg_response_time || 999) < 24) score += 1;

  return score / max;
}

/**
 * Get distinct client ids for a user.
 * Falls back to the earnings table when clients.user_id is not available.
 */
export async function getUserClientIds(userId: string): Promise<string[]> {
  const { data: directClients } = await supabaseServer
    .from("clients")
    .select("id")
    .eq("user_id", userId);

  if (directClients && directClients.length > 0) {
    return Array.from(new Set(directClients.map((c: { id: string }) => c.id).filter(Boolean)));
  }

  const { data: earningRows, error: earningsError } = await supabaseServer
    .from("earnings")
    .select("client_id")
    .eq("user_id", userId)
    .not("client_id", "is", null);

  if (earningsError) {
    console.error("getUserClientIds: failed to load client ids", earningsError.message);
    return [];
  }

  return Array.from(
    new Set((earningRows || []).map((row: { client_id: string | null }) => String(row.client_id || "")).filter(Boolean))
  );
}

async function getClientEarningsMetrics(clientId: string): Promise<{ lifetime_value: number; jobs_completed: number }> {
  const { data: earnings } = await supabaseServer
    .from("earnings")
    .select("amount")
    .eq("client_id", clientId);

  const rows = earnings || [];
  return {
    lifetime_value: rows.reduce((sum: number, row: { amount: number | string | null }) => sum + Number(row.amount || 0), 0),
    jobs_completed: rows.length,
  };
}

/**
 * Persist updated score to the clients table
 */
export async function updateClientScore(clientId: string): Promise<{ score: number; tier: ScoreTier } | null> {
  const { data: client } = await supabaseServer
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.id) {
    console.error("updateClientScore: client not found", clientId);
    return null;
  }

  const earningsMetrics = await getClientEarningsMetrics(clientId);
  const scoringInput = {
    lifetime_value: Number(earningsMetrics.lifetime_value || 0),
    jobs_completed: Number(earningsMetrics.jobs_completed || 0),
    avg_response_time: 24,
    message_count: 0,
    retention_probability: 0,
  };

  const retention = estimateRetentionProbability(scoringInput);
  const score = calculateClientScore({ ...scoringInput, retention_probability: retention });
  const tier = getScoreTier(score);

  const { error: updateError } = await supabaseServer
    .from("clients")
    .update({
      score,
      score_tier: tier,
      retention_probability: retention,
      lifetime_value: scoringInput.lifetime_value,
      jobs_completed: scoringInput.jobs_completed,
    })
    .eq("id", clientId);

  if (updateError) {
    console.warn("updateClientScore: non-fatal update warning", updateError.message);
  }

  return { score, tier };
}

/**
 * Score all clients for a given user — called daily by account manager
 */
export async function rescoreAllClients(userId: string): Promise<void> {
  const clientIds = await getUserClientIds(userId);
  if (!clientIds.length) return;

  await Promise.all(clientIds.map((clientId) => updateClientScore(clientId)));
  console.log(`✅ Rescored ${clientIds.length} clients for user ${userId}`);
}
