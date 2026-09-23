import { supabaseServer } from "@/lib/supabaseServer";
import { logger } from "@/lib/logger/logger";

export interface RevenueDimensions {
  platform?: string;
  roleType?: string;
  clientCategory?: string;
  region?: string;
}

export interface RevenueMetrics {
  grossRevenue: number;
  dealsClosed: number;
  proposalsSent: number;
  closeRate: number;
  avgResponseMs: number;
}

export interface RevenueInsight {
  dimension: string;
  value: string;
  grossRevenue: number;
  closeRate: number;
  avgResponseMs: number;
  label: string;           // human-readable ranking label
}

/** Write or update a revenue analytics row for today */
export async function recordRevenueMetric(
  dims: RevenueDimensions,
  delta: Partial<RevenueMetrics>
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const { data: existing } = await supabaseServer
      .from("revenue_analytics")
      .select("id, gross_revenue, deals_closed, proposals_sent")
      .eq("period_date", today)
      .eq("platform",   dims.platform   ?? "unknown")
      .eq("role_type",  dims.roleType   ?? "unknown")
      .eq("region",     dims.region     ?? "unknown")
      .single();

    if (existing) {
      const dealsClosed    = (existing.deals_closed    as number) + (delta.dealsClosed    ?? 0);
      const proposalsSent  = (existing.proposals_sent  as number) + (delta.proposalsSent  ?? 0);
      const grossRevenue   = (existing.gross_revenue   as number) + (delta.grossRevenue   ?? 0);
      const closeRate      = proposalsSent > 0 ? dealsClosed / proposalsSent : 0;

      await supabaseServer
        .from("revenue_analytics")
        .update({
          gross_revenue:   grossRevenue,
          deals_closed:    dealsClosed,
          proposals_sent:  proposalsSent,
          close_rate:      closeRate,
          avg_response_ms: delta.avgResponseMs ?? 0,
        })
        .eq("id", existing.id as string);
    } else {
      const dealsClosed   = delta.dealsClosed   ?? 0;
      const proposalsSent = delta.proposalsSent ?? 0;
      await supabaseServer.from("revenue_analytics").insert({
        period_date:     today,
        platform:        dims.platform        ?? "unknown",
        role_type:       dims.roleType        ?? "unknown",
        client_category: dims.clientCategory  ?? "unknown",
        region:          dims.region          ?? "unknown",
        gross_revenue:   delta.grossRevenue   ?? 0,
        deals_closed:    dealsClosed,
        proposals_sent:  proposalsSent,
        close_rate:      proposalsSent > 0 ? dealsClosed / proposalsSent : 0,
        avg_response_ms: delta.avgResponseMs  ?? 0,
      });
    }
  } catch (err) {
    logger.error("[REVENUE] Failed to record metric", err, { dims }, "revenueOptimization");
  }
}

/** Revenue breakdown by platform over last N days */
export async function getRevenueByPlatform(days = 30): Promise<RevenueInsight[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data } = await supabaseServer
    .from("revenue_analytics")
    .select("platform, gross_revenue, deals_closed, proposals_sent, close_rate, avg_response_ms")
    .gte("period_date", since)
    .not("platform", "eq", "unknown");

  if (!data) return [];

  const grouped: Record<string, RevenueInsight> = {};
  for (const row of data as Record<string, unknown>[]) {
    const key = String(row.platform ?? "unknown");
    if (!grouped[key]) {
      grouped[key] = { dimension: "platform", value: key, grossRevenue: 0, closeRate: 0, avgResponseMs: 0, label: "" };
    }
    grouped[key].grossRevenue   += Number(row.gross_revenue  ?? 0);
    grouped[key].closeRate      = Number(row.close_rate      ?? 0);
    grouped[key].avgResponseMs  = Number(row.avg_response_ms ?? 0);
  }

  return rankInsights(Object.values(grouped));
}

/** Revenue breakdown by role type */
export async function getRevenueByRoleType(days = 30): Promise<RevenueInsight[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data } = await supabaseServer
    .from("revenue_analytics")
    .select("role_type, gross_revenue, close_rate, avg_response_ms")
    .gte("period_date", since)
    .not("role_type", "eq", "unknown");

  if (!data) return [];

  const grouped: Record<string, RevenueInsight> = {};
  for (const row of data as Record<string, unknown>[]) {
    const key = String(row.role_type ?? "unknown");
    if (!grouped[key]) {
      grouped[key] = { dimension: "roleType", value: key, grossRevenue: 0, closeRate: 0, avgResponseMs: 0, label: "" };
    }
    grouped[key].grossRevenue  += Number(row.gross_revenue  ?? 0);
    grouped[key].closeRate     = Number(row.close_rate      ?? 0);
    grouped[key].avgResponseMs = Number(row.avg_response_ms ?? 0);
  }

  return rankInsights(Object.values(grouped));
}

/** Revenue breakdown by client category */
export async function getRevenueByClientCategory(days = 30): Promise<RevenueInsight[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data } = await supabaseServer
    .from("revenue_analytics")
    .select("client_category, gross_revenue, close_rate, avg_response_ms")
    .gte("period_date", since)
    .not("client_category", "eq", "unknown");

  if (!data) return [];

  const grouped: Record<string, RevenueInsight> = {};
  for (const row of data as Record<string, unknown>[]) {
    const key = String(row.client_category ?? "unknown");
    if (!grouped[key]) {
      grouped[key] = { dimension: "clientCategory", value: key, grossRevenue: 0, closeRate: 0, avgResponseMs: 0, label: "" };
    }
    grouped[key].grossRevenue  += Number(row.gross_revenue  ?? 0);
    grouped[key].closeRate     = Number(row.close_rate      ?? 0);
    grouped[key].avgResponseMs = Number(row.avg_response_ms ?? 0);
  }

  return rankInsights(Object.values(grouped));
}

/** Revenue breakdown by region */
export async function getRevenueByRegion(days = 30): Promise<RevenueInsight[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data } = await supabaseServer
    .from("revenue_analytics")
    .select("region, gross_revenue, close_rate, avg_response_ms")
    .gte("period_date", since)
    .not("region", "eq", "unknown");

  if (!data) return [];

  const grouped: Record<string, RevenueInsight> = {};
  for (const row of data as Record<string, unknown>[]) {
    const key = String(row.region ?? "unknown");
    if (!grouped[key]) {
      grouped[key] = { dimension: "region", value: key, grossRevenue: 0, closeRate: 0, avgResponseMs: 0, label: "" };
    }
    grouped[key].grossRevenue  += Number(row.gross_revenue  ?? 0);
    grouped[key].closeRate     = Number(row.close_rate      ?? 0);
    grouped[key].avgResponseMs = Number(row.avg_response_ms ?? 0);
  }

  return rankInsights(Object.values(grouped));
}

/** Composite profit-per-hour ranking across all dimensions */
export async function getTopPerformers(days = 30): Promise<{
  platforms: RevenueInsight[];
  roleTypes: RevenueInsight[];
  regions: RevenueInsight[];
  clientCategories: RevenueInsight[];
}> {
  const [platforms, roleTypes, regions, clientCategories] = await Promise.all([
    getRevenueByPlatform(days),
    getRevenueByRoleType(days),
    getRevenueByRegion(days),
    getRevenueByClientCategory(days),
  ]);

  return {
    platforms:        platforms.slice(0, 5),
    roleTypes:        roleTypes.slice(0, 5),
    regions:          regions.slice(0, 5),
    clientCategories: clientCategories.slice(0, 5),
  };
}

/** Assign human-readable performance labels and sort by revenue */
function rankInsights(insights: RevenueInsight[]): RevenueInsight[] {
  const sorted = insights.sort((a, b) => b.grossRevenue - a.grossRevenue);

  return sorted.map((item, idx) => ({
    ...item,
    label: idx === 0 ? "🥇 Top performer" :
           idx === 1 ? "🥈 Strong"        :
           idx === 2 ? "🥉 Solid"         :
           item.closeRate > 0.5 ? "📈 High close rate" :
           item.avgResponseMs < 3_600_000 ? "⚡ Fast responder" :
           "📊 Tracked",
  }));
}
