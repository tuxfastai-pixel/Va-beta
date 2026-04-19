import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const [closedCountRes, closedValueRes, activeCountRes] = await Promise.all([
    supabaseServer.from("deals").select("id", { count: "exact", head: true }).eq("status", "closed"),
    supabaseServer.from("deals").select("value").eq("status", "closed").limit(5000),
    supabaseServer.from("deals").select("id", { count: "exact", head: true }).eq("status", "negotiating"),
  ]);

  if (closedCountRes.error || closedValueRes.error || activeCountRes.error) {
    return NextResponse.json(
      {
        error:
          closedCountRes.error?.message ||
          closedValueRes.error?.message ||
          activeCountRes.error?.message ||
          "Failed to load deals summary",
      },
      { status: 500 }
    );
  }

  const revenue = (closedValueRes.data || []).reduce((sum, row) => sum + toNumber(row.value), 0);

  return NextResponse.json({
    closed_deals: Number(closedCountRes.count || 0),
    revenue,
    active_deals: Number(activeCountRes.count || 0),
  });
}
