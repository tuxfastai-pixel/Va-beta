import { supabaseServer } from "@/lib/supabaseServer";

export interface PlatformAllocation {
  platform: string;
  region: string;
  roiScore: number;
  closeRate: number;
  avgRevenuePerDeal: number;
  currentTrafficShare: number;
  targetTrafficShare: number;
  suggestedShiftPct: number;
  confidence: number;
  sampleSize: number;
  rationale: string;
}

export interface PlatformOptimizationSnapshot {
  generatedAt: string;
  allocations: PlatformAllocation[];
  topPlatform?: PlatformAllocation;
  topRegion?: string;
  confidence: number;
  sampleSize: number;
}

export interface PlatformOptimizationOptions {
  maxShiftPct?: number;
  minSamples?: number;
  minConfidence?: number;
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function scoreRow(input: { revenue: number; dealsClosed: number; proposalsSent: number; closeRate: number }): number {
  const avgRevenuePerDeal = input.dealsClosed > 0 ? input.revenue / input.dealsClosed : 0;
  return input.closeRate * 0.45 + avgRevenuePerDeal * 0.015 + input.revenue * 0.003 + input.dealsClosed * 2;
}

export async function optimizePlatformTraffic(
  days = 30,
  options?: PlatformOptimizationOptions
): Promise<PlatformOptimizationSnapshot> {
  const maxShiftPct = Math.max(3, Number(options?.maxShiftPct ?? 12));
  const minSamples = Math.max(1, Number(options?.minSamples ?? 20));
  const minConfidence = Math.max(0.2, Math.min(1, Number(options?.minConfidence ?? 0.45)));

  const since = new Date();
  since.setDate(since.getDate() - Math.max(7, days));

  const previousStart = new Date(since);
  previousStart.setDate(previousStart.getDate() - Math.max(7, days));

  const [{ data }, { data: previous }] = await Promise.all([
    supabaseServer
      .from("revenue_analytics")
      .select("platform, region, gross_revenue, deals_closed, proposals_sent, close_rate")
      .gte("period_date", since.toISOString().slice(0, 10)),
    supabaseServer
      .from("revenue_analytics")
      .select("platform, region, gross_revenue")
      .gte("period_date", previousStart.toISOString().slice(0, 10))
      .lt("period_date", since.toISOString().slice(0, 10)),
  ]);

  const sampleSize = (data ?? []).length;
  const confidence = sampleSize >= 120 ? 0.86 : sampleSize >= 60 ? 0.72 : sampleSize >= minSamples ? 0.52 : 0.3;
  const allowOptimization = sampleSize >= minSamples && confidence >= minConfidence;

  const grouped = new Map<string, { platform: string; region: string; revenue: number; dealsClosed: number; proposalsSent: number; closeRate: number }>();

  for (const row of (data ?? []) as Array<{
    platform: string | null;
    region: string | null;
    gross_revenue: number | null;
    deals_closed: number | null;
    proposals_sent: number | null;
    close_rate: number | null;
  }>) {
    const platform = String(row.platform || "unknown");
    const region = String(row.region || "GLOBAL");
    const key = `${platform}:${region}`;

    const current = grouped.get(key) ?? {
      platform,
      region,
      revenue: 0,
      dealsClosed: 0,
      proposalsSent: 0,
      closeRate: 0,
    };

    current.revenue += asNumber(row.gross_revenue);
    current.dealsClosed += asNumber(row.deals_closed);
    current.proposalsSent += asNumber(row.proposals_sent);
    current.closeRate += asNumber(row.close_rate);
    grouped.set(key, current);
  }

  const base = Array.from(grouped.values()).map((row) => {
    const closeRate = row.proposalsSent > 0 ? Number(((row.dealsClosed / row.proposalsSent) * 100).toFixed(1)) : row.closeRate;
    const avgRevenuePerDeal = row.dealsClosed > 0 ? Number((row.revenue / row.dealsClosed).toFixed(2)) : 0;
    const roiScore = Number(scoreRow({ revenue: row.revenue, dealsClosed: row.dealsClosed, proposalsSent: row.proposalsSent, closeRate }).toFixed(2));

    return {
      platform: row.platform,
      region: row.region,
      roiScore,
      closeRate,
      avgRevenuePerDeal,
    };
  });

  const totalScore = base.reduce((sum, row) => sum + Math.max(0.1, row.roiScore), 0);
  const previousRevenueByKey = new Map<string, number>();
  let previousRevenueTotal = 0;
  for (const row of (previous ?? []) as Array<{ platform: string | null; region: string | null; gross_revenue: number | null }>) {
    const key = `${String(row.platform || "unknown")}:${String(row.region || "GLOBAL")}`;
    const revenue = asNumber(row.gross_revenue);
    previousRevenueByKey.set(key, (previousRevenueByKey.get(key) ?? 0) + revenue);
    previousRevenueTotal += revenue;
  }

  const allocations: PlatformAllocation[] = base
    .map((row) => {
      const rawTargetShare = totalScore > 0
        ? Number((((Math.max(0.1, row.roiScore) / totalScore) * 100)).toFixed(1))
        : 0;

      const previousKey = `${row.platform}:${row.region}`;
      const currentTrafficShare = previousRevenueTotal > 0
        ? Number((((previousRevenueByKey.get(previousKey) ?? 0) / previousRevenueTotal) * 100).toFixed(1))
        : Number((100 / Math.max(1, base.length)).toFixed(1));

      const requestedShift = rawTargetShare - currentTrafficShare;
      const boundedShift = Math.max(-maxShiftPct, Math.min(maxShiftPct, requestedShift));
      const boundedTargetShare = allowOptimization
        ? Number((currentTrafficShare + boundedShift).toFixed(1))
        : currentTrafficShare;

      return {
        platform: row.platform,
        region: row.region,
        roiScore: row.roiScore,
        closeRate: row.closeRate,
        avgRevenuePerDeal: row.avgRevenuePerDeal,
        currentTrafficShare,
        targetTrafficShare: boundedTargetShare,
        suggestedShiftPct: Number((boundedTargetShare - currentTrafficShare).toFixed(1)),
        confidence: Number(confidence.toFixed(2)),
        sampleSize,
        rationale: allowOptimization
          ? `Shift bounded to +/-${maxShiftPct}% around current share.`
          : `Guardrail blocked: samples=${sampleSize}, confidence=${confidence.toFixed(2)}.`,
      };
    })
    .sort((left, right) => right.roiScore - left.roiScore);

  const topPlatform = allocations[0];
  const regionRank = new Map<string, number>();
  for (const row of allocations) {
    regionRank.set(row.region, (regionRank.get(row.region) ?? 0) + row.roiScore);
  }
  const topRegion = Array.from(regionRank.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];

  return {
    generatedAt: new Date().toISOString(),
    allocations,
    topPlatform,
    topRegion,
    confidence: Number(confidence.toFixed(2)),
    sampleSize,
  };
}

export async function optimizePlatforms(
  days = 30,
  options?: PlatformOptimizationOptions
): Promise<PlatformOptimizationSnapshot> {
  return optimizePlatformTraffic(days, options);
}
