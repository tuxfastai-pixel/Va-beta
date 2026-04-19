import { getUserClientIds } from "@/lib/clients/clientScoring";
import { supabaseServer } from "@/lib/supabaseServer";

export interface ForecastResult {
  predicted_monthly: number;
  predicted_growth: number;
  confidence: number;
  basis_records: number;
  retainer_monthly: number;
  strategy_hint: "increase_volume" | "increase_pricing" | "push_retainers" | "hold_steady";
}

/**
 * Compute average monthly earnings from historical records
 */
function computeAverageMonthly(earnings: Array<{ amount: number | string | null; created_at: string | null }>): number {
  if (!earnings.length) return 0;

  // Group by calendar month
  const byMonth = new Map<string, number>();
  for (const row of earnings) {
    const month = String(row.created_at || "").slice(0, 7); // "YYYY-MM"
    if (!month) continue;
    byMonth.set(month, (byMonth.get(month) || 0) + Number(row.amount || 0));
  }

  const values = Array.from(byMonth.values());
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Estimate month-over-month growth rate
 */
function computeGrowthRate(earnings: Array<{ amount: number | string | null; created_at: string | null }>): number {
  const byMonth = new Map<string, number>();
  for (const row of earnings) {
    const month = String(row.created_at || "").slice(0, 7);
    if (!month) continue;
    byMonth.set(month, (byMonth.get(month) || 0) + Number(row.amount || 0));
  }

  const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length < 2) return 1.0;

  const last = sorted[sorted.length - 1][1];
  const prev = sorted[sorted.length - 2][1];
  if (!prev) return 1.0;

  return Math.min(5, Math.max(0.1, last / prev)); // cap at 5x or 0.1x
}

/**
 * Generate income forecast for a user
 */
export async function generateForecast(userId: string): Promise<ForecastResult> {
  const { data: earnings } = await supabaseServer
    .from("earnings")
    .select("amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(90); // last 90 records

  const records = earnings || [];

  if (!records.length) {
    return {
      predicted_monthly: 0,
      predicted_growth: 1.0,
      confidence: 0,
      basis_records: 0,
      retainer_monthly: 0,
      strategy_hint: "increase_volume",
    };
  }

  // Sum up active retainer income from clients linked to this user
  let retainerMonthly = 0;
  const clientIds = await getUserClientIds(userId);

  if (clientIds.length > 0) {
    const { data: retainerClients } = await supabaseServer
      .from("clients")
      .select("monthly_retainer_value")
      .in("id", clientIds)
      .eq("is_retainer", true);

    retainerMonthly = (retainerClients || []).reduce(
      (sum: number, c: { monthly_retainer_value: number | string | null }) => sum + Number(c.monthly_retainer_value || 0),
      0
    );
  }

  const avgMonthly = computeAverageMonthly(records);
  const growth = computeGrowthRate(records);
  const confidence = Math.min(1, records.length / 20); // full confidence at 20+ records

  const predictedMonthly = (avgMonthly * growth) + retainerMonthly;

  // Determine strategy hint
  let strategy_hint: ForecastResult["strategy_hint"] = "hold_steady";
  if (retainerMonthly < avgMonthly * 0.2) {
    strategy_hint = "push_retainers";
  } else if (growth < 1.0) {
    strategy_hint = "increase_volume";
  } else if (growth > 1.5) {
    strategy_hint = "increase_pricing";
  }

  return {
    predicted_monthly: Math.round(predictedMonthly * 100) / 100,
    predicted_growth: Math.round(growth * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    basis_records: records.length,
    retainer_monthly: Math.round(retainerMonthly * 100) / 100,
    strategy_hint,
  };
}

/**
 * Persist forecast snapshot to database
 */
export async function saveForecast(userId: string): Promise<ForecastResult> {
  const forecast = await generateForecast(userId);

  const { error } = await supabaseServer.from("income_forecasts").insert({
    user_id: userId,
    predicted_monthly: forecast.predicted_monthly,
    predicted_growth: forecast.predicted_growth,
    confidence: forecast.confidence,
    basis_records: forecast.basis_records,
    retainer_monthly: forecast.retainer_monthly,
  });

  if (error) {
    console.warn("saveForecast: non-fatal insert warning", error.message);
  }

  return forecast;
}

/**
 * Get the most recent forecast for a user
 */
export async function getLatestForecast(userId: string): Promise<ForecastResult | null> {
  const { data } = await supabaseServer
    .from("income_forecasts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return generateForecast(userId);
  }

  return {
    predicted_monthly: Number(data.predicted_monthly),
    predicted_growth: Number(data.predicted_growth),
    confidence: Number(data.confidence),
    basis_records: Number(data.basis_records || 0),
    retainer_monthly: Number(data.retainer_monthly || 0),
    strategy_hint: "hold_steady",
  };
}

/**
 * Adjust strategy actions based on forecast vs goal
 * Returns delta to apply to apply_per_day and outreach
 */
export function adjustStrategyFromForecast(
  forecast: ForecastResult,
  goalMonthlyTarget: number
): { apply_delta: number; outreach_delta: number; reason: string } {
  const gap = goalMonthlyTarget - forecast.predicted_monthly;
  const pct = goalMonthlyTarget > 0 ? gap / goalMonthlyTarget : 0;

  if (pct > 0.5) {
    // Far below goal — push hard
    return { apply_delta: 5, outreach_delta: 5, reason: "low_forecast_push_volume" };
  }
  if (pct > 0.2) {
    // Slightly below — moderate increase
    return { apply_delta: 2, outreach_delta: 3, reason: "below_goal_moderate_increase" };
  }
  if (pct < -0.2) {
    // Well above goal — quality over quantity
    return { apply_delta: -2, outreach_delta: 0, reason: "above_goal_focus_quality" };
  }
  return { apply_delta: 0, outreach_delta: 0, reason: "on_track" };
}
