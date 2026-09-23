import { supabaseServer } from "@/lib/supabaseServer";

export interface RevenueForecastPoint {
  date: string;
  actualRevenue?: number;
  predictedRevenue: number;
}

export interface RevenueForecastSnapshot {
  horizonDays: number;
  projectedRevenue: number;
  projectedRecurringRevenue: number;
  trend: "up" | "flat" | "down";
  confidence: number;
  series: RevenueForecastPoint[];
}

export interface RevenueForecastBundle {
  forecast7Day: RevenueForecastSnapshot;
  forecast30Day: RevenueForecastSnapshot;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function movingAverage(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;
  const window = values.slice(-Math.max(1, windowSize));
  return window.reduce((sum, value) => sum + value, 0) / window.length;
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    const x = index - xMean;
    const y = values[index] - yMean;
    numerator += x * y;
    denominator += x * x;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

async function getDailyRevenueSeries(lookbackDays: number): Promise<Array<{ date: string; revenue: number }>> {
  const start = new Date();
  start.setDate(start.getDate() - Math.max(lookbackDays, 30));

  const { data } = await supabaseServer
    .from("revenue_analytics")
    .select("period_date, gross_revenue")
    .gte("period_date", dayKey(start))
    .order("period_date", { ascending: true });

  const byDate = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ period_date: string; gross_revenue: number | null }>) {
    const date = String(row.period_date || "");
    byDate.set(date, (byDate.get(date) ?? 0) + asNumber(row.gross_revenue));
  }

  const output: Array<{ date: string; revenue: number }> = [];
  for (let i = lookbackDays - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    output.push({ date: key, revenue: byDate.get(key) ?? 0 });
  }

  return output;
}

async function getRecurringRevenueBaseline(): Promise<number> {
  const { data } = await supabaseServer
    .from("subscriptions")
    .select("amount")
    .eq("status", "active");

  return (data ?? []).reduce((sum, row) => sum + asNumber((row as { amount?: unknown }).amount), 0);
}

export async function forecastRevenue(horizonDays = 7): Promise<RevenueForecastSnapshot> {
  const lookbackDays = 30;
  const [history, recurringBaseline] = await Promise.all([
    getDailyRevenueSeries(lookbackDays),
    getRecurringRevenueBaseline(),
  ]);

  const values = history.map((point) => point.revenue);
  const shortMean = movingAverage(values, 7);
  const longMean = movingAverage(values, 21);
  const slope = linearSlope(values);
  const trendBias = shortMean - longMean;

  const series: RevenueForecastPoint[] = history.map((point) => ({
    date: point.date,
    actualRevenue: point.revenue,
    predictedRevenue: point.revenue,
  }));

  for (let day = 1; day <= horizonDays; day += 1) {
    const date = new Date();
    date.setDate(date.getDate() + day);

    const predicted = Math.max(0, shortMean + slope * day + trendBias * 0.25);
    series.push({ date: dayKey(date), predictedRevenue: Number(predicted.toFixed(2)) });
  }

  const projectedRevenue = series
    .slice(-horizonDays)
    .reduce((sum, point) => sum + asNumber(point.predictedRevenue), 0);

  const projectedRecurringRevenue = Number(((recurringBaseline / 30) * horizonDays).toFixed(2));
  const trend: RevenueForecastSnapshot["trend"] = slope > 5 ? "up" : slope < -5 ? "down" : "flat";

  const variance = values.length > 0
    ? values.reduce((sum, value) => sum + Math.pow(value - longMean, 2), 0) / values.length
    : 0;
  const confidence = Math.max(20, Math.min(95, Math.round(90 - Math.sqrt(variance) / 10 - Math.abs(slope) / 5)));

  return {
    horizonDays,
    projectedRevenue: Number(projectedRevenue.toFixed(2)),
    projectedRecurringRevenue,
    trend,
    confidence,
    series,
  };
}

export async function forecastRevenue7Day(): Promise<RevenueForecastSnapshot> {
  return forecastRevenue(7);
}

export async function forecastRevenue30Day(): Promise<RevenueForecastSnapshot> {
  return forecastRevenue(30);
}

export async function getRevenueForecast(): Promise<RevenueForecastBundle> {
  const [forecast7Day, forecast30Day] = await Promise.all([
    forecastRevenue7Day(),
    forecastRevenue30Day(),
  ]);

  return {
    forecast7Day,
    forecast30Day,
  };
}
