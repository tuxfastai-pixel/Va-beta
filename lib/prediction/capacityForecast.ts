import { supabaseServer } from "@/lib/supabaseServer";

export interface CapacityForecast {
  horizonDays: number;
  workloadSaturation: number;
  overloadRisk: number;
  slaBreachProbability: number;
  currentOpenDeals: number;
  currentOverdueSla: number;
  expectedDailyThroughput: number;
  recommendation: string;
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function clamp(input: number): number {
  return Math.max(0, Math.min(100, Math.round(input)));
}

export async function forecastCapacity(horizonDays = 14): Promise<CapacityForecast> {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [dealsRes, slaRes, activityRes, agentRes] = await Promise.all([
    supabaseServer
      .from("deals")
      .select("id, stage")
      .in("stage", ["lead", "contacted", "interview", "negotiation"]),
    supabaseServer
      .from("sla_records")
      .select("id, status")
      .in("status", ["pending", "overdue"]),
    supabaseServer
      .from("activities")
      .select("id, created_at")
      .gte("created_at", since.toISOString()),
    supabaseServer
      .from("agent_activities")
      .select("id, created_at, outcome")
      .gte("created_at", since.toISOString()),
  ]);

  const openDeals = dealsRes.data?.length ?? 0;
  const pendingOrOverdueSla = slaRes.data ?? [];
  const overdueSla = pendingOrOverdueSla.filter((row) => String((row as { status?: string }).status) === "overdue").length;
  const activityCount = activityRes.data?.length ?? 0;
  const agentActions = agentRes.data ?? [];
  const failureCount = agentActions.filter((row) => String((row as { outcome?: string }).outcome) === "failure").length;

  const expectedDailyThroughput = Number(((activityCount + agentActions.length) / 14).toFixed(1));

  const workloadSaturation = clamp(openDeals * 3 + pendingOrOverdueSla.length * 4 + Math.max(0, 40 - expectedDailyThroughput));
  const overloadRisk = clamp(workloadSaturation * 0.55 + overdueSla * 9 + failureCount * 4);
  const slaBreachProbability = clamp(overdueSla * 12 + Math.max(0, openDeals - asNumber(expectedDailyThroughput)) * 2.5 + failureCount * 3);

  const recommendation = overloadRisk >= 70
    ? "High overload risk: throttle new proposals and rebalance workload to Billing/Retention agents."
    : overloadRisk >= 40
      ? "Moderate pressure: increase follow-up automation and enforce stricter milestone gating."
      : "Capacity healthy: continue current pace and monitor SLA trend daily.";

  return {
    horizonDays,
    workloadSaturation,
    overloadRisk,
    slaBreachProbability,
    currentOpenDeals: openDeals,
    currentOverdueSla: overdueSla,
    expectedDailyThroughput,
    recommendation,
  };
}
