import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateWorkerScore } from "@/lib/ai/workerScore";

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function startOfTodayIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

type ActiveJobRow = {
  pay_amount?: number | string | null;
  currency?: string | null;
  pay_currency?: string | null;
};

function calculateProjectedMonthlyEarnings(activeJobs: ActiveJobRow[]) {
  const rates: Record<string, number> = {
    USD: 1,
    GBP: 1.27,
    AED: 0.27,
    ZAR: 0.053,
  };

  let usdTotal = 0;

  for (const job of activeJobs) {
    const amount = Number(job.pay_amount || 0);
    const currency = String(job.currency || job.pay_currency || "USD").toUpperCase();
    const toUsdRate = rates[currency] ?? 1;

    usdTotal += amount * toUsdRate;
  }

  return Math.round(usdTotal * 4);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const todayIso = startOfTodayIso();

  const [{ data: user }, { data: todayJobs }, { data: applications }, { data: activeJobs }, { data: memoryRows }] =
    await Promise.all([
      supabase.from("users").select("id").eq("id", userId).maybeSingle(),
      supabase.from("jobs").select("id, created_at").eq("user_id", userId).gte("created_at", todayIso),
      supabase.from("applications").select("status, response_status, response_received").eq("user_id", userId),
      supabase.from("active_jobs").select("pay_amount, currency, pay_currency").eq("user_id", userId),
      supabase
        .from("ai_memory")
        .select("memory_type, content, created_at")
        .eq("user_id", userId)
        .in("memory_type", [
          "job_strategy",
          "client_response",
          "successful_job_type",
          "preferred_industry",
          "worker_last_run",
          "worker_last_error",
        ])
        .order("created_at", { ascending: false }),
    ]);

  const workerName = `${String(user?.id || userId).split("@")[0]}Worker`;
  const strategyMarket = memoryRows?.find((m) => m.memory_type === "job_strategy")?.content?.preferred_market;
  const markets = strategyMarket
    ? [strategyMarket]
    : ["US", "UK", "DE", "FR", "NL", "UAE"];

  const jobsFoundToday = (todayJobs || []).length;
  const applicationsSent = (applications || []).length;
  const responses = (applications || []).filter(
    (app) =>
      app.response_received === true ||
      String(app.status || "").toLowerCase() === "responded" ||
      String(app.response_status || "").toLowerCase() === "responded"
  ).length;

  const automationLevel =
    jobsFoundToday === 0
      ? 0
      : Math.min(95, Math.round((applicationsSent / Math.max(1, jobsFoundToday)) * 100));

  const projectedMonthlyEarnings = calculateProjectedMonthlyEarnings(activeJobs || []);
  const workerScore = calculateWorkerScore({
    jobs_won: responses,
    applications_sent: applicationsSent,
    client_rating: Math.min(1, responses / Math.max(applicationsSent, 1)),
    response_speed: Math.min(1, automationLevel / 100),
    earnings_factor: Math.min(1, projectedMonthlyEarnings / 5000),
  });
  const lastRunRow = memoryRows?.find((m) => m.memory_type === "worker_last_run");
  const lastErrorRow = memoryRows?.find((m) => m.memory_type === "worker_last_error");

  const lastRunTime =
    lastRunRow?.content?.ran_at ||
    (typeof lastRunRow?.created_at === "string" ? lastRunRow.created_at : null);
  const lastError = lastErrorRow?.content?.message || null;

  return NextResponse.json({
    worker_name: workerName,
    markets,
    jobs_found_today: jobsFoundToday,
    applications_sent: applicationsSent,
    responses,
    automation_level: automationLevel,
    worker_score: workerScore,
    projected_monthly_earnings: projectedMonthlyEarnings,
    last_run_time: lastRunTime,
    last_error: lastError,
  });
}
