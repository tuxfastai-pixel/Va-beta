import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type PaymentRow = {
  job_id: string | null;
  created_at: string | null;
};

export async function GET() {
  const { data: payments, error } = await supabase
    .from("payments")
    .select("job_id, created_at")
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();

  const grouped = {
    stage1: 0,
    stage2: 0,
    stage3: 0,
    expiring: 0,
  };

  const details: Array<{ job_id: string | null; hours_pending: number; stage: string }> = [];

  for (const payment of (payments || []) as PaymentRow[]) {
    const hours = (now - new Date(String(payment.created_at || new Date().toISOString())).getTime()) / (1000 * 60 * 60);

    let stage = "none";

    if (hours > 2 && hours <= 24) {
      grouped.stage1 += 1;
      stage = "stage1";
    } else if (hours > 24 && hours <= 48) {
      grouped.stage2 += 1;
      stage = "stage2";
    } else if (hours > 48) {
      grouped.stage3 += 1;
      grouped.expiring += 1;
      stage = "stage3";
    }

    details.push({
      job_id: payment.job_id,
      hours_pending: Math.round(hours),
      stage,
    });
  }

  return NextResponse.json({
    summary: grouped,
    total_pending: payments?.length || 0,
    details,
  });
}