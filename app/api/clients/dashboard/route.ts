import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isUuid } from "@/lib/clients/clientApiAuth";
import {
  calculateClientScore,
  estimateRetentionProbability,
  getScoreTier,
  getUserClientIds,
  rescoreAllClients,
} from "@/lib/clients/clientScoring";

// GET /api/clients/dashboard?userId=<uuid>&rescore=true
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const rescore = req.nextUrl.searchParams.get("rescore") === "true";

  if (!userId || !isUuid(userId)) {
    return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
  }

  if (rescore) {
    await rescoreAllClients(userId);
  }

  const clientIds = await getUserClientIds(userId);
  if (!clientIds.length) {
    return NextResponse.json({
      summary: {
        total: 0,
        vip: 0,
        high: 0,
        medium: 0,
        low: 0,
        retainer_clients: 0,
        total_ltv: 0,
        monthly_retainer_income: 0,
      },
      clients: [],
    });
  }

  const { data: clientRows, error } = await supabaseServer
    .from("clients")
    .select("id, name, email, created_at")
    .in("id", clientIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Failed to fetch clients: ${error.message}` }, { status: 500 });
  }

  const { data: earningsRows } = await supabaseServer
    .from("earnings")
    .select("client_id, amount")
    .eq("user_id", userId)
    .in("client_id", clientIds);

  const metricsByClient = new Map<string, { lifetime_value: number; jobs_completed: number }>();
  for (const row of earningsRows || []) {
    const clientId = String(row.client_id || "");
    if (!clientId) continue;
    const current = metricsByClient.get(clientId) || { lifetime_value: 0, jobs_completed: 0 };
    current.lifetime_value += Number(row.amount || 0);
    current.jobs_completed += 1;
    metricsByClient.set(clientId, current);
  }

  const clients = (clientRows || []).map((client) => {
    const metrics = metricsByClient.get(String(client.id)) || { lifetime_value: 0, jobs_completed: 0 };
    const retention_probability = estimateRetentionProbability({
      lifetime_value: metrics.lifetime_value,
      jobs_completed: metrics.jobs_completed,
      avg_response_time: 24,
      message_count: 0,
    });
    const score = calculateClientScore({
      lifetime_value: metrics.lifetime_value,
      jobs_completed: metrics.jobs_completed,
      avg_response_time: 24,
      message_count: 0,
      retention_probability,
    });

    return {
      ...client,
      score,
      score_tier: getScoreTier(score),
      lifetime_value: metrics.lifetime_value,
      retention_probability,
      last_interaction: null,
      jobs_completed: metrics.jobs_completed,
      avg_response_time: 24,
      message_count: 0,
      is_retainer: false,
      monthly_retainer_value: 0,
    };
  }).sort((a, b) => b.score - a.score);

  const summary = {
    total: clients.length,
    vip: clients.filter((c) => c.score_tier === "vip").length,
    high: clients.filter((c) => c.score_tier === "high").length,
    medium: clients.filter((c) => c.score_tier === "medium").length,
    low: clients.filter((c) => c.score_tier === "low").length,
    retainer_clients: clients.filter((c) => c.is_retainer).length,
    total_ltv: clients.reduce((s, c) => s + (c.lifetime_value ?? 0), 0),
    monthly_retainer_income: clients
      .filter((c) => c.is_retainer)
      .reduce((s, c) => s + (c.monthly_retainer_value ?? 0), 0),
  };

  return NextResponse.json({ summary, clients });
}
