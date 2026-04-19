import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const [jobsRes, invoicesRes] = await Promise.all([
    supabaseServer
      .from("jobs")
      .select("id, title, status, company, match_score, pay_amount, currency, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseServer
      .from("invoices")
      .select("id, description, amount, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (jobsRes.error || invoicesRes.error) {
    return NextResponse.json(
      { error: jobsRes.error?.message || invoicesRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobs: jobsRes.data || [],
    invoices: invoicesRes.data || [],
  });
}
