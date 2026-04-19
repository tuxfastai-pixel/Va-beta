import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [invoicesRes, closedDealsRes, jobsRes] = await Promise.all([
    supabaseServer.from("invoices").select("amount, created_at").gte("created_at", since).limit(5000),
    supabaseServer.from("deals").select("id", { count: "exact", head: true }).eq("status", "closed"),
    supabaseServer.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  if (invoicesRes.error || closedDealsRes.error || jobsRes.error) {
    return NextResponse.json(
      {
        error:
          invoicesRes.error?.message ||
          closedDealsRes.error?.message ||
          jobsRes.error?.message ||
          "Failed to calculate prediction",
      },
      { status: 500 }
    );
  }

  const amounts = (invoicesRes.data || []).map((row) => toNumber(row.amount));
  const total = amounts.length;
  const avg = total ? amounts.reduce((sum, value) => sum + value, 0) / total : 0;

  const closedDeals = Number(closedDealsRes.count || 0);
  const completedJobs = Number(jobsRes.count || 0);

  const dealBoost = Math.min(0.2, closedDeals * 0.01);
  const jobBoost = Math.min(0.2, completedJobs * 0.005);
  const predicted = avg * total * (1.2 + dealBoost + jobBoost);

  return NextResponse.json({
    predictedRevenue: Number(predicted.toFixed(2)),
    avgInvoiceValue: Number(avg.toFixed(2)),
    invoiceCount30d: total,
    closedDeals,
    completedJobs,
  });
}
