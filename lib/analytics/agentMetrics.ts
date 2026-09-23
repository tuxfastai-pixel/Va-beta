import { supabaseServer } from "@/lib/supabaseServer";

export type AgentTraceSeverity = "info" | "warning" | "error";

export interface AgentPerformanceRow {
  agentName: string;
  actions: number;
  successes: number;
  failures: number;
  closeRate: number;
  revenueGenerated: number;
  averageResponseMs: number;
}

export interface WorkflowTraceEvent {
  source: "agent" | "audit" | "activity";
  title: string;
  detail: string;
  timestamp: string;
  severity: AgentTraceSeverity;
}

export interface AgentObservabilitySnapshot {
  activeAgents: number;
  totalActions: number;
  failures: number;
  revenueGenerated: number;
  averageResponseMs: number;
  closeRate: number;
  slaBreaches: number;
  dealsInPipeline: number;
  systemHealth: number;
  byAgent: AgentPerformanceRow[];
  eventStream: WorkflowTraceEvent[];
  workflowTrace: WorkflowTraceEvent[];
}

function startDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(0, days));
  return date.toISOString();
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function pickResponseMs(payload: Record<string, unknown> | null | undefined): number {
  if (!payload) return 0;
  return asNumber(
    payload.response_ms ??
      payload.responseTimeMs ??
      payload.response_time_ms ??
      payload.latency_ms
  );
}

function pickRevenue(payload: Record<string, unknown> | null | undefined, kpiDelta: number): number {
  if (!payload) return Math.max(0, kpiDelta);
  const revenue = asNumber(payload.revenue ?? payload.amount ?? payload.value ?? payload.gross_revenue);
  return revenue > 0 ? revenue : Math.max(0, kpiDelta);
}

function toTraceEvent(input: {
  source: "agent" | "audit" | "activity";
  title: string;
  detail: string;
  timestamp: string;
  severity?: AgentTraceSeverity;
}): WorkflowTraceEvent {
  return {
    source: input.source,
    title: input.title,
    detail: input.detail,
    timestamp: input.timestamp,
    severity: input.severity ?? "info",
  };
}

export async function getAgentObservabilitySnapshot(days = 7): Promise<AgentObservabilitySnapshot> {
  const since = startDate(days);

  const [agentRes, auditRes, dealRes, activityRes, slaRes] = await Promise.all([
    supabaseServer
      .from("agent_activities")
      .select("agent_name, action, outcome, kpi_delta, payload, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseServer
      .from("audit_logs")
      .select("event_type, entity_type, entity_id, payload, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseServer
      .from("deals")
      .select("id, stage, created_at, updated_at")
      .gte("created_at", since),
    supabaseServer
      .from("activities")
      .select("deal_id, type, note, metadata, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseServer
      .from("sla_records")
      .select("status")
      .eq("status", "overdue"),
  ]);

  const agentRows = (agentRes.data ?? []) as Array<{
    agent_name: string;
    action: string;
    outcome: string | null;
    kpi_delta: number | null;
    payload: Record<string, unknown> | null;
    created_at: string;
  }>;

  const auditRows = (auditRes.data ?? []) as Array<{
    event_type: string;
    entity_type: string;
    entity_id: string;
    payload: Record<string, unknown> | null;
    created_at: string;
  }>;

  const activityRows = (activityRes.data ?? []) as Array<{
    deal_id: string;
    type: string;
    note: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  const dealRows = (dealRes.data ?? []) as Array<{
    id: string;
    stage: string | null;
    created_at: string;
    updated_at: string | null;
  }>;

  const byAgentMap = new Map<string, AgentPerformanceRow>();
  let totalActions = 0;
  let failures = 0;
  let revenueGenerated = 0;
  let responseMsTotal = 0;
  let responseCount = 0;
  let closeSignals = 0;

  for (const row of agentRows) {
    totalActions += 1;
    const key = row.agent_name || "UnknownAgent";
    const current = byAgentMap.get(key) ?? {
      agentName: key,
      actions: 0,
      successes: 0,
      failures: 0,
      closeRate: 0,
      revenueGenerated: 0,
      averageResponseMs: 0,
    };

    current.actions += 1;
    const isFailure = String(row.outcome || "").toLowerCase() === "failure";
    if (isFailure) {
      failures += 1;
      current.failures += 1;
    } else {
      current.successes += 1;
    }

    const revenue = pickRevenue(row.payload, asNumber(row.kpi_delta));
    revenueGenerated += revenue;
    current.revenueGenerated += revenue;

    const responseMs = pickResponseMs(row.payload);
    if (responseMs > 0) {
      responseMsTotal += responseMs;
      responseCount += 1;
      current.averageResponseMs = Math.round((current.averageResponseMs * (current.actions - 1) + responseMs) / current.actions);
    }

    const actionText = `${row.action} ${JSON.stringify(row.payload ?? {})}`.toLowerCase();
    if (actionText.includes("close") || actionText.includes("won") || actionText.includes("paid")) {
      closeSignals += 1;
    }

    current.closeRate = current.actions > 0 ? Number(((current.successes / current.actions) * 100).toFixed(1)) : 0;
    byAgentMap.set(key, current);
  }

  const activeAgents = byAgentMap.size;
  const overdueSlaCount = (slaRes.data ?? []).length;
  const dealsInPipeline = dealRows.filter((deal) => !["closed_won", "closed_lost"].includes(String(deal.stage || ""))).length;
  const averageResponseMs = responseCount > 0 ? Math.round(responseMsTotal / responseCount) : 0;
  const closeRate = totalActions > 0 ? Number(((closeSignals / totalActions) * 100).toFixed(1)) : 0;
  const systemHealth = Math.max(0, Math.min(100, Math.round(100 - failures * 5 - overdueSlaCount * 7 + Math.min(10, activeAgents * 2))));

  const eventStream = [
    ...agentRows.slice(0, 12).map((row) =>
      toTraceEvent({
        source: "agent",
        title: row.agent_name,
        detail: `${row.action} • ${String(row.outcome || "unknown")}`,
        timestamp: row.created_at,
        severity: String(row.outcome || "").toLowerCase() === "failure" ? "error" : "info",
      })
    ),
    ...auditRows.slice(0, 8).map((row) =>
      toTraceEvent({
        source: "audit",
        title: row.event_type,
        detail: `${row.entity_type}:${row.entity_id}`,
        timestamp: row.created_at,
        severity: row.event_type.includes("failed") || row.event_type.includes("missed") ? "warning" : "info",
      })
    ),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  const workflowTrace = [
    ...activityRows.slice(0, 10).map((row) =>
      toTraceEvent({
        source: "activity",
        title: row.type,
        detail: row.note,
        timestamp: row.created_at,
        severity: row.type === "proposal" || row.type === "meeting" ? "info" : "warning",
      })
    ),
    ...dealRows.slice(0, 8).map((deal) =>
      toTraceEvent({
        source: "activity",
        title: `deal:${deal.stage || "unknown"}`,
        detail: `Deal ${deal.id}`,
        timestamp: deal.updated_at || deal.created_at,
        severity: ["closed_lost"].includes(String(deal.stage || "")) ? "warning" : "info",
      })
    ),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  return {
    activeAgents,
    totalActions,
    failures,
    revenueGenerated,
    averageResponseMs,
    closeRate,
    slaBreaches: overdueSlaCount,
    dealsInPipeline,
    systemHealth,
    byAgent: Array.from(byAgentMap.values()).sort((left, right) => right.revenueGenerated - left.revenueGenerated),
    eventStream,
    workflowTrace,
  };
}
