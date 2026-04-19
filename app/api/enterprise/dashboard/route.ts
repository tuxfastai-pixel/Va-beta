import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function amountOf(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const companyId = String(req.nextUrl.searchParams.get("company_id") || "").trim();

  if (!companyId) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  const { data: company } = await supabaseServer
    .from("companies")
    .select("id, name, plan, license_per_user_usd")
    .eq("id", companyId)
    .maybeSingle();

  const { data: members } = await supabaseServer
    .from("client_users")
    .select("id")
    .eq("company_id", companyId);

  const memberIds = (members || []).map((m) => String(m.id));
  const employeesUsingAI = memberIds.length;

  if (memberIds.length === 0) {
    return NextResponse.json({
      company: company || null,
      metrics: {
        total_earnings_generated: 0,
        employees_using_ai: 0,
        jobs_completed: 0,
        roi_percent: 0,
      },
    });
  }

  const { data: earningsRows } = await supabaseServer
    .from("earnings")
    .select("amount, status, user_id")
    .in("user_id", memberIds);

  const { data: closedDeals } = await supabaseServer
    .from("deals")
    .select("id, user_id")
    .eq("stage", "closed")
    .in("user_id", memberIds);

  const totalEarnings = (earningsRows || [])
    .filter((row) => String(row.status || "").toLowerCase() !== "pending")
    .reduce((sum, row) => sum + amountOf(row.amount), 0);

  const jobsCompleted = (closedDeals || []).length;
  const licensePerUser = amountOf(company?.license_per_user_usd || 10);
  const licenseCost = licensePerUser * Math.max(1, employeesUsingAI);
  const roiPercent = licenseCost > 0 ? Number((((totalEarnings - licenseCost) / licenseCost) * 100).toFixed(2)) : 0;

  return NextResponse.json({
    company: company || null,
    metrics: {
      total_earnings_generated: totalEarnings,
      employees_using_ai: employeesUsingAI,
      jobs_completed: jobsCompleted,
      roi_percent: roiPercent,
    },
  });
}
