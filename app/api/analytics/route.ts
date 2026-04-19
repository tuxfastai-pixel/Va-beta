import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const [leadsCountRes, closedDealsCountRes, invoicesRes] = await Promise.all([
    supabaseServer.from("leads").select("id", { count: "exact", head: true }),
    supabaseServer.from("deals").select("id", { count: "exact", head: true }).eq("status", "closed"),
    supabaseServer.from("invoices").select("amount").limit(5000),
  ]);

  if (leadsCountRes.error || closedDealsCountRes.error || invoicesRes.error) {
    return NextResponse.json(
      {
        error:
          leadsCountRes.error?.message ||
          closedDealsCountRes.error?.message ||
          invoicesRes.error?.message ||
          "Failed to load analytics",
      },
      { status: 500 }
    );
  }

  const revenue = (invoicesRes.data || []).reduce((sum, row) => sum + toNumber(row.amount), 0);

  return NextResponse.json({
    totalLeads: Number(leadsCountRes.count || 0),
    closedDeals: Number(closedDealsCountRes.count || 0),
    revenue: Number(revenue.toFixed(2)),
  });
}
