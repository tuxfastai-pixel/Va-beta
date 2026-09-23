import { supabaseServer } from "@/lib/supabaseServer";
import { logRevenue } from "@/lib/revenue/log";

export { logRevenue };

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function startOfMonth() {
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function getTodayRevenue() {
  const { data, error } = await supabaseServer.from("revenue").select("amount").gte("created_at", startOfToday());
  if (error) {
    return 0;
  }
  return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export async function getMonthRevenue() {
  const { data, error } = await supabaseServer.from("revenue").select("amount").gte("created_at", startOfMonth());
  if (error) {
    return 0;
  }
  return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export async function getRevenueByStream() {
  const { data, error } = await supabaseServer.from("revenue").select("amount, stream");
  if (error) {
    return {};
  }
  const buckets: Record<string, number> = {};

  for (const row of data || []) {
    const stream = String(row.stream || "general");
    buckets[stream] = (buckets[stream] || 0) + Number(row.amount || 0);
  }

  return buckets;
}