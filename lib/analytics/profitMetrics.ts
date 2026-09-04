import { supabaseServer } from "@/lib/supabaseServer";

export interface RevenueSegment {
  label: string;
  revenue: number;
  dealsClosed: number;
  proposalsSent: number;
  closeRate: number;
  estimatedMargin: number;
}

export interface RecurringRevenueSnapshot {
  currentRecurringRevenue: number;
  previousRecurringRevenue: number;
  growthRate: number;
  activeSubscriptions: number;
}

export interface ProfitabilitySnapshot {
  totalRevenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  estimatedMargin: number;
  recurring: RecurringRevenueSnapshot;
  byPlatform: RevenueSegment[];
  byNiche: RevenueSegment[];
}

function startDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(0, days));
  return date.toISOString().slice(0, 10);
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function estimateCostRate(label: string): number {
  const key = label.toLowerCase();

  if (key.includes("linkedin") || key.includes("enterprise")) return 0.28;
  if (key.includes("indeed") || key.includes("administrative")) return 0.22;
  if (key.includes("pnet") || key.includes("tender") || key.includes("finance")) return 0.18;
  if (key.includes("uk") || key.includes("eu")) return 0.24;
  return 0.21;
}

function buildSegment(label: string, revenue: number, dealsClosed: number, proposalsSent: number): RevenueSegment {
  const closeRate = proposalsSent > 0 ? Number(((dealsClosed / proposalsSent) * 100).toFixed(1)) : 0;
  const estimatedMargin = Number(((1 - estimateCostRate(label)) * 100).toFixed(1));

  return {
    label,
    revenue,
    dealsClosed,
    proposalsSent,
    closeRate,
    estimatedMargin,
  };
}

async function loadRevenueRows(days: number) {
  const since = startDate(days);
  const { data } = await supabaseServer
    .from("revenue_analytics")
    .select("period_date, platform, role_type, client_category, region, gross_revenue, deals_closed, proposals_sent, close_rate, avg_response_ms")
    .gte("period_date", since)
    .order("period_date", { ascending: false });

  return (data ?? []) as Array<{
    period_date: string;
    platform: string | null;
    role_type: string | null;
    client_category: string | null;
    region: string | null;
    gross_revenue: number | null;
    deals_closed: number | null;
    proposals_sent: number | null;
    close_rate: number | null;
    avg_response_ms: number | null;
  }>;
}

function aggregateRows(rows: Array<Record<string, unknown>>, field: "platform" | "role_type") {
  const grouped = new Map<string, { revenue: number; dealsClosed: number; proposalsSent: number }>();

  for (const row of rows) {
    const label = String(row[field] || "unknown");
    const current = grouped.get(label) ?? { revenue: 0, dealsClosed: 0, proposalsSent: 0 };
    current.revenue += asNumber(row.gross_revenue);
    current.dealsClosed += asNumber(row.deals_closed);
    current.proposalsSent += asNumber(row.proposals_sent);
    grouped.set(label, current);
  }

  return Array.from(grouped.entries())
    .map(([label, values]) => buildSegment(label, values.revenue, values.dealsClosed, values.proposalsSent))
    .sort((left, right) => right.revenue - left.revenue);
}

async function getRecurringRevenueSnapshot(): Promise<RecurringRevenueSnapshot> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);

  const [currentRes, previousRes] = await Promise.all([
    supabaseServer
      .from("subscriptions")
      .select("amount, status, created_at")
      .eq("status", "active")
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabaseServer
      .from("subscriptions")
      .select("amount, status, created_at")
      .eq("status", "active")
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const currentRecurringRevenue = (currentRes.data ?? []).reduce((sum, row) => sum + asNumber((row as { amount?: unknown }).amount), 0);
  const previousRecurringRevenue = (previousRes.data ?? []).reduce((sum, row) => sum + asNumber((row as { amount?: unknown }).amount), 0);
  const growthRate = previousRecurringRevenue > 0
    ? Number((((currentRecurringRevenue - previousRecurringRevenue) / previousRecurringRevenue) * 100).toFixed(1))
    : currentRecurringRevenue > 0
      ? 100
      : 0;

  return {
    currentRecurringRevenue,
    previousRecurringRevenue,
    growthRate,
    activeSubscriptions: currentRes.data?.length ?? 0,
  };
}

export async function getProfitabilitySnapshot(days = 30): Promise<ProfitabilitySnapshot> {
  const rows = await loadRevenueRows(days);
  const rowObjects = rows as unknown as Array<Record<string, unknown>>;

  const byPlatform = aggregateRows(rowObjects, "platform");
  const byNiche = aggregateRows(rowObjects, "role_type");
  const totalRevenue = rows.reduce((sum, row) => sum + asNumber(row.gross_revenue), 0);
  const estimatedCost = byPlatform.reduce((sum, segment) => sum + segment.revenue * (estimateCostRate(segment.label)), 0);
  const estimatedProfit = totalRevenue - estimatedCost;
  const estimatedMargin = totalRevenue > 0 ? Number(((estimatedProfit / totalRevenue) * 100).toFixed(1)) : 0;

  return {
    totalRevenue,
    estimatedCost: Number(estimatedCost.toFixed(2)),
    estimatedProfit: Number(estimatedProfit.toFixed(2)),
    estimatedMargin,
    recurring: await getRecurringRevenueSnapshot(),
    byPlatform,
    byNiche,
  };
}
