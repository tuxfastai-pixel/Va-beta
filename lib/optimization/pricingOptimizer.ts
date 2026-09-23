import { getPlatformWeight, normalisePrice, type Region } from "@/lib/geo/regionProfiles";
import { supabaseServer } from "@/lib/supabaseServer";

export interface PricingInput {
  region: Region;
  niche: string;
  basePrice: number;
  urgency?: "low" | "normal" | "high";
  platform?: string;
}

export interface PricingRecommendation {
  region: Region;
  niche: string;
  basePrice: number;
  recommendedPrice: number;
  urgencyMultiplier: number;
  nicheMultiplier: number;
  platformMultiplier: number;
  rationale: string[];
}

export interface PricingOptimizationDecision {
  dealId: string;
  currentValue: number;
  recommendedValue: number;
  adjustmentPct: number;
  confidence: number;
  sampleSize: number;
  applied: boolean;
  reason: string;
}

export interface PricingOptimizationOptions {
  maxAdjustmentPct?: number;
  minSamples?: number;
  minConfidence?: number;
}

const NICHE_MULTIPLIERS: Record<string, number> = {
  finance_cleanup: 1.35,
  audit_prep: 1.4,
  tender_documentation: 1.3,
  crm_admin: 1.15,
  compliance_admin: 1.25,
  va_operations: 1.1,
  sales_follow_up: 1.2,
};

const URGENCY_MULTIPLIERS: Record<NonNullable<PricingInput["urgency"]>, number> = {
  low: 0.95,
  normal: 1,
  high: 1.25,
};

function clampMoney(value: number): number {
  return Number(Math.max(0, value).toFixed(2));
}

export function recommendPrice(input: PricingInput): PricingRecommendation {
  const urgencyMultiplier = URGENCY_MULTIPLIERS[input.urgency ?? "normal"];
  const nicheKey = input.niche.toLowerCase().replaceAll(" ", "_");
  const nicheMultiplier = NICHE_MULTIPLIERS[nicheKey] ?? 1.08;
  const platformWeight = input.platform ? getPlatformWeight(input.platform, input.region) : 0.5;
  const platformMultiplier = 0.9 + platformWeight * 0.25;

  const adjusted = input.basePrice * urgencyMultiplier * nicheMultiplier * platformMultiplier;
  const floored = normalisePrice(adjusted, input.region, "project");

  const rationale = [
    `Urgency multiplier ${urgencyMultiplier.toFixed(2)} (${input.urgency ?? "normal"})`,
    `Niche multiplier ${nicheMultiplier.toFixed(2)} for ${input.niche}`,
    `Platform multiplier ${platformMultiplier.toFixed(2)} from weight ${platformWeight.toFixed(2)}`,
  ];

  return {
    region: input.region,
    niche: input.niche,
    basePrice: input.basePrice,
    recommendedPrice: clampMoney(floored),
    urgencyMultiplier,
    nicheMultiplier,
    platformMultiplier,
    rationale,
  };
}

export async function optimizeOpenDealPricing(
  limit = 100,
  options?: PricingOptimizationOptions
): Promise<PricingOptimizationDecision[]> {
  const maxAdjustmentPct = Math.max(1, Number(options?.maxAdjustmentPct ?? 5));
  const minSamples = Math.max(1, Number(options?.minSamples ?? 20));
  const minConfidence = Math.max(0.2, Math.min(1, Number(options?.minConfidence ?? 0.45)));

  const { data } = await supabaseServer
    .from("deals")
    .select("id, value, stage, notes, client_id")
    .in("stage", ["lead", "contacted", "interview", "negotiation"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!data || data.length === 0) return [];

  const { count: sampleCount } = await supabaseServer
    .from("revenue_analytics")
    .select("id", { count: "exact", head: true })
    .gte("period_date", new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));

  const sampleSize = Number(sampleCount || 0);
  const confidence = sampleSize >= 120 ? 0.85 : sampleSize >= 60 ? 0.7 : sampleSize >= minSamples ? 0.5 : 0.3;
  const allowOptimization = sampleSize >= minSamples && confidence >= minConfidence;

  const clientIds = data.map((deal) => (deal as { client_id?: string }).client_id).filter(Boolean) as string[];
  const { data: clients } = clientIds.length > 0
    ? await supabaseServer.from("clients").select("id, region, source").in("id", clientIds)
    : { data: [] as Array<{ id: string; region: string; source: string }> };

  const clientMap = new Map<string, { region?: string; source?: string }>();
  for (const client of clients ?? []) {
    const row = client as { id: string; region?: string; source?: string };
    clientMap.set(row.id, { region: row.region, source: row.source });
  }

  const recommendations: PricingOptimizationDecision[] = [];

  for (const deal of data as Array<{ id: string; value: number; notes?: string; client_id?: string }>) {
    const currentValue = Number(deal.value || 0);
    const client = clientMap.get(String(deal.client_id || ""));
    const regionText = String(client?.region || "global").toUpperCase();
    const region = (["ZA", "US", "UK", "EU", "AU"].includes(regionText) ? regionText : "GLOBAL") as Region;
    const niche = String(deal.notes || "general").toLowerCase().includes("finance") ? "finance_cleanup" : "crm_admin";

    const pricing = recommendPrice({
      region,
      niche,
      basePrice: currentValue,
      urgency: "normal",
      platform: client?.source || "linkedin",
    });

    const rawAdjustmentPct = currentValue > 0
      ? ((pricing.recommendedPrice - currentValue) / currentValue) * 100
      : 0;
    const boundedAdjustmentPct = Math.max(-maxAdjustmentPct, Math.min(maxAdjustmentPct, rawAdjustmentPct));
    const boundedValue = currentValue > 0
      ? currentValue * (1 + boundedAdjustmentPct / 100)
      : pricing.recommendedPrice;

    recommendations.push({
      dealId: deal.id,
      currentValue,
      recommendedValue: Number(boundedValue.toFixed(2)),
      adjustmentPct: Number(boundedAdjustmentPct.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      sampleSize,
      applied: allowOptimization,
      reason: allowOptimization
        ? `bounded to +/-${maxAdjustmentPct}%`
        : `guardrail blocked (samples=${sampleSize}, confidence=${confidence.toFixed(2)})`,
    });
  }

  return recommendations;
}

export async function optimizePricing(
  limit = 100,
  options?: PricingOptimizationOptions
): Promise<PricingOptimizationDecision[]> {
  return optimizeOpenDealPricing(limit, options);
}
