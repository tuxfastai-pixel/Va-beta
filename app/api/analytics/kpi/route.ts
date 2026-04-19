import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type FunnelEventRow = {
  step: string | null;
  email?: string | null;
  created_at: string;
};

type EmailStatRow = {
  status: string | null;
  created_at: string;
};

type DealRow = {
  status: string | null;
  created_at: string;
};

type EmailAccountRow = {
  sent_total?: number | null;
};

type ComputedMetrics = {
  adClicks: number;
  leadsCreated: number;
  subscriptions: number;
  closedDeals: number;
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
  emailsBounced: number;
  ctr: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  closeRate: number;
  costPerLead: number;
  monthlyEmailCost: number;
  accountCount: number;
  conversionFunnel: {
    leadToDeal: number;
    dealToSubscription: number;
  };
};

type AssessmentBuckets = {
  healthy: string[];
  warning: string[];
  critical: string[];
};

type TrendRow = {
  created_at: string;
  status?: string | null;
  step?: string | null;
};

/**
 * KPI Targets
 */
const KPI_TARGETS = {
  CTR: { min: 0.02, max: 0.05, unit: "%" },
  costPerLead: { max: 10, unit: "$" },
  closeRate: { min: 0.05, max: 0.15, unit: "%" },
  openRate: { target: 0.3, unit: "%" },
  replyRate: { target: 0.1, unit: "%" },
} as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "30", 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: funnelEvents } = await supabaseServer
      .from("funnel_events")
      .select("step, email, created_at")
      .gte("created_at", startDate);

    const { data: emailStats } = await supabaseServer
      .from("cold_email_sends")
      .select("status, created_at")
      .gte("created_at", startDate);

    const { data: deals } = await supabaseServer
      .from("deals")
      .select("status, created_at")
      .gte("created_at", startDate);

    const { data: accounts } = await supabaseServer
      .from("email_accounts")
      .select("sent_total");

    const metrics = calculateMetrics(
      (funnelEvents as FunnelEventRow[] | null) || [],
      (emailStats as EmailStatRow[] | null) || [],
      (deals as DealRow[] | null) || [],
      (accounts as EmailAccountRow[] | null) || []
    );

    const assessment = assessPerformance(metrics);

    return NextResponse.json({
      period: `Last ${days} days`,
      metrics,
      targets: KPI_TARGETS,
      assessment,
      chartData: {
        dailyLeads: getDailyTrend((funnelEvents as FunnelEventRow[] | null) || [], "lead_created"),
        dailyOpens: getDailyTrend((emailStats as EmailStatRow[] | null) || [], "opened"),
        dailyCloses: getDailyTrend((deals as DealRow[] | null) || [], "closed"),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function calculateMetrics(
  funnelEvents: FunnelEventRow[],
  emailStats: EmailStatRow[],
  deals: DealRow[],
  accounts: EmailAccountRow[]
): ComputedMetrics {
  const adClicks = funnelEvents.filter((event) => event.step === "ad_click").length;
  const leadsCreated = funnelEvents.filter((event) => event.step === "lead_created").length;
  const subscriptions = funnelEvents.filter((event) => event.step === "subscription_created").length;

  const emailsSent = emailStats.filter((event) => event.status === "sent").length;
  const emailsOpened = emailStats.filter((event) => event.status === "opened").length;
  const emailsReplied = emailStats.filter((event) => event.status === "replied").length;
  const emailsBounced = emailStats.filter((event) => event.status === "bounced").length;

  const closedDeals = deals.filter((deal) => deal.status === "closed").length;
  const accountCount = accounts.length;
  const monthlyEmailCost = accountCount * 10;

  const ctr = emailsSent > 0 ? (adClicks / emailsSent) * 100 : 0;
  const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
  const replyRate = emailsSent > 0 ? (emailsReplied / emailsSent) * 100 : 0;
  const bounceRate = emailsSent > 0 ? (emailsBounced / emailsSent) * 100 : 0;
  const closeRate = leadsCreated > 0 ? (closedDeals / leadsCreated) * 100 : 0;
  const costPerLead = leadsCreated > 0 ? monthlyEmailCost / leadsCreated : 0;
  const dealToSubscriptionRate = closedDeals > 0 ? (subscriptions / closedDeals) * 100 : 0;

  return {
    adClicks,
    leadsCreated,
    subscriptions,
    closedDeals,
    emailsSent,
    emailsOpened,
    emailsReplied,
    emailsBounced,
    ctr: parseFloat(ctr.toFixed(2)),
    openRate: parseFloat(openRate.toFixed(2)),
    replyRate: parseFloat(replyRate.toFixed(2)),
    bounceRate: parseFloat(bounceRate.toFixed(2)),
    closeRate: parseFloat(closeRate.toFixed(2)),
    costPerLead: parseFloat(costPerLead.toFixed(2)),
    monthlyEmailCost,
    accountCount,
    conversionFunnel: {
      leadToDeal: closeRate,
      dealToSubscription: parseFloat(dealToSubscriptionRate.toFixed(2)),
    },
  };
}

function assessPerformance(metrics: ComputedMetrics): AssessmentBuckets {
  const assessment: AssessmentBuckets = {
    healthy: [],
    warning: [],
    critical: [],
  };

  if (metrics.ctr >= KPI_TARGETS.CTR.min * 100 && metrics.ctr <= KPI_TARGETS.CTR.max * 100) {
    assessment.healthy.push(`CTR: ${metrics.ctr}% ✅ (target: 2-5%)`);
  } else if (metrics.ctr < KPI_TARGETS.CTR.min * 100) {
    assessment.critical.push(`CTR: ${metrics.ctr}% ❌ (target: 2-5%)`);
  } else {
    assessment.warning.push(`CTR: ${metrics.ctr}% ⚠️ (target: 2-5%)`);
  }

  if (metrics.costPerLead <= KPI_TARGETS.costPerLead.max) {
    assessment.healthy.push(`Cost per lead: $${metrics.costPerLead} ✅ (target: <$10)`);
  } else {
    assessment.warning.push(`Cost per lead: $${metrics.costPerLead} ⚠️ (target: <$10)`);
  }

  if (
    metrics.closeRate >= KPI_TARGETS.closeRate.min * 100 &&
    metrics.closeRate <= KPI_TARGETS.closeRate.max * 100
  ) {
    assessment.healthy.push(`Close rate: ${metrics.closeRate}% ✅ (target: 5-15%)`);
  } else if (metrics.closeRate < KPI_TARGETS.closeRate.min * 100) {
    assessment.critical.push(`Close rate: ${metrics.closeRate}% ❌ (target: 5-15%)`);
  } else {
    assessment.warning.push(`Close rate: ${metrics.closeRate}% ⚠️ (target: 5-15%)`);
  }

  if (metrics.openRate >= 25) {
    assessment.healthy.push(`Open rate: ${metrics.openRate}% ✅ (good)`);
  } else if (metrics.openRate >= 15) {
    assessment.warning.push(`Open rate: ${metrics.openRate}% ⚠️ (below average)`);
  } else {
    assessment.critical.push(`Open rate: ${metrics.openRate}% ❌ (poor)`);
  }

  if (metrics.replyRate >= 5) {
    assessment.healthy.push(`Reply rate: ${metrics.replyRate}% ✅ (strong)`);
  } else if (metrics.replyRate >= 2) {
    assessment.warning.push(`Reply rate: ${metrics.replyRate}% ⚠️ (below target)`);
  } else {
    assessment.critical.push(`Reply rate: ${metrics.replyRate}% ❌ (critical)`);
  }

  return assessment;
}

function getDailyTrend(data: TrendRow[], filterField: "lead_created" | "opened" | "closed") {
  const byDay: Record<string, number> = {};

  data.forEach((item) => {
    if (filterField === "opened" && item.status !== "opened") return;
    if (filterField === "closed" && item.status !== "closed") return;
    if (filterField === "lead_created" && item.step !== "lead_created") return;

    const date = new Date(item.created_at).toLocaleDateString();
    byDay[date] = (byDay[date] || 0) + 1;
  });

  return Object.entries(byDay).map(([date, count]) => ({ date, count }));
}
