import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type EarningsRow = {
  amount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string | null;
  job_id?: string | null;
  client_id?: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const clientId = searchParams.get("client_id");
  const userId = searchParams.get("user_id");

  let query = supabase
    .from("earnings")
    .select("amount, currency, status, created_at, job_id, client_id");

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (clientId) query = query.eq("client_id", clientId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as EarningsRow[];
  const rowsToAggregate = userId
    ? (() => {
        const latestByJob = new Map<string, EarningsRow>();

        for (const row of rows) {
          const key = String(row.job_id || `__row_${latestByJob.size}`);
          const prev = latestByJob.get(key);
          const currentCreatedAt = Date.parse(String(row.created_at || ""));
          const previousCreatedAt = Date.parse(String(prev?.created_at || ""));

          if (!prev || Number.isNaN(previousCreatedAt) || currentCreatedAt >= previousCreatedAt) {
            latestByJob.set(key, row);
          }
        }

        return Array.from(latestByJob.values());
      })()
    : rows;

  const result = {
    total: 0,
    byCurrency: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  };

  for (const row of rowsToAggregate) {
    const amount = Number(row.amount || 0);
    result.total += amount;

    const currency = String(row.currency || "UNKNOWN").toUpperCase();
    result.byCurrency[currency] = (result.byCurrency[currency] || 0) + amount;

    const status = String(row.status || "unknown").toLowerCase();
    result.byStatus[status] = (result.byStatus[status] || 0) + amount;
  }

  return NextResponse.json(result);
}
