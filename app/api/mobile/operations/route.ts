import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

interface OperationalMetrics {
  urgentJobs: number;
  priorityLeads: number;
  newInterviews: number;
  pendingPayments: number;
  tenderDeadlines: number;
  slaBreaches: number;
  highConfidenceApps: number;
  dailyRevenue: number;
}

interface MobileOperationsResponse {
  success: boolean;
  timestamp: string;
  metrics: OperationalMetrics;
  urgentItems: Array<{
    id: string;
    type: "job" | "lead" | "interview" | "payment" | "tender" | "sla";
    title: string;
    description: string;
    priority: "critical" | "high" | "medium";
    dueAt?: string;
    actionUrl?: string;
  }>;
  approvalQueue: Array<{
    id: string;
    type: "auto_apply" | "tender" | "contract" | "negotiation" | "resume_variant" | "pricing";
    title: string;
    description: string;
    expiresAt: string;
    requiresApproval: boolean;
  }>;
  slaStatus: Array<{
    account: string;
    health: "healthy" | "warning" | "breach";
    nextCheckAt: string;
  }>;
  dailyRevenueTrend?: {
    today: number;
    yesterday: number;
    weekAverage: number;
    trend: "up" | "down" | "stable";
  };
}

async function getOperationalMetrics(userId: string): Promise<OperationalMetrics> {
  try {
    // Fetch urgent jobs (open positions matching profile, apply deadline today)
    const { data: jobs, error: jobsError } = await supabaseServer
      .from("deals")
      .select("id")
      .eq("user_id", userId)
      .eq("deal_type", "job")
      .lte("apply_deadline", new Date().toISOString())
      .limit(100);

    const urgentJobs = !jobsError ? (jobs?.length || 0) : 0;

    // Fetch priority leads (recent contact, no follow-up yet)
    const { data: leads, error: leadsError } = await supabaseServer
      .from("deals")
      .select("id")
      .eq("user_id", userId)
      .eq("deal_type", "lead")
      .eq("stage", "contacted")
      .lte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    const priorityLeads = !leadsError ? (leads?.length || 0) : 0;

    // Fetch new interviews (scheduled within 48 hours)
    const { data: interviews, error: interviewsError } = await supabaseServer
      .from("deals")
      .select("id")
      .eq("user_id", userId)
      .eq("stage", "interview")
      .lte("scheduled_at", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
      .gte("scheduled_at", new Date().toISOString())
      .limit(100);

    const newInterviews = !interviewsError ? (interviews?.length || 0) : 0;

    // Fetch pending payments
    const { data: payments, error: paymentsError } = await supabaseServer
      .from("invoices")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(100);

    const pendingPayments = !paymentsError ? (payments?.length || 0) : 0;

    // Fetch tender deadlines (closing within 7 days)
    const { data: tenders, error: tendersError } = await supabaseServer
      .from("tenders")
      .select("id")
      .eq("user_id", userId)
      .lte("closing_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .gte("closing_date", new Date().toISOString())
      .limit(100);

    const tenderDeadlines = !tendersError ? (tenders?.length || 0) : 0;

    // Fetch SLA breaches
    const { data: slaData, error: slaError } = await supabaseServer
      .from("sla_metrics")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "healthy")
      .limit(100);

    const slaBreaches = !slaError ? (slaData?.length || 0) : 0;

    // Fetch high confidence applications (>85% match, last 24h)
    const { data: apps, error: appsError } = await supabaseServer
      .from("applications")
      .select("id")
      .eq("user_id", userId)
      .gte("confidence_score", 85)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    const highConfidenceApps = !appsError ? (apps?.length || 0) : 0;

    // Fetch daily revenue
    const { data: revenue, error: revenueError } = await supabaseServer
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const dailyRevenue = !revenueError && revenue
      ? revenue.reduce((sum, t) => sum + (t.amount || 0), 0)
      : 0;

    return {
      urgentJobs,
      priorityLeads,
      newInterviews,
      pendingPayments,
      tenderDeadlines,
      slaBreaches,
      highConfidenceApps,
      dailyRevenue,
    };
  } catch (error) {
    console.error("Error fetching operational metrics:", error);
    return {
      urgentJobs: 0,
      priorityLeads: 0,
      newInterviews: 0,
      pendingPayments: 0,
      tenderDeadlines: 0,
      slaBreaches: 0,
      highConfidenceApps: 0,
      dailyRevenue: 0,
    };
  }
}

async function getUrgentItems(userId: string) {
  const urgentItems = [];

  try {
    // Urgent job deadlines
    const { data: jobs } = await supabaseServer
      .from("deals")
      .select("id, job_title, company, apply_deadline")
      .eq("user_id", userId)
      .eq("deal_type", "job")
      .lte("apply_deadline", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .gte("apply_deadline", new Date().toISOString())
      .limit(5);

    if (jobs) {
      urgentItems.push(...jobs.map(j => ({
        id: j.id,
        type: "job" as const,
        title: j.job_title || "Job Opportunity",
        description: `${j.company || "Unknown"} - Apply deadline approaching`,
        priority: "high" as const,
        dueAt: j.apply_deadline,
      })));
    }

    // Tender deadlines
    const { data: tenders } = await supabaseServer
      .from("tenders")
      .select("id, title, closing_date")
      .eq("user_id", userId)
      .lte("closing_date", new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
      .gte("closing_date", new Date().toISOString())
      .limit(5);

    if (tenders) {
      urgentItems.push(...tenders.map(t => ({
        id: t.id,
        type: "tender" as const,
        title: t.title || "Tender Opportunity",
        description: "Tender closing soon",
        priority: "critical" as const,
        dueAt: t.closing_date,
      })));
    }

    // SLA breaches
    const { data: slaBreaches } = await supabaseServer
      .from("sla_metrics")
      .select("id, account, status")
      .eq("user_id", userId)
      .eq("status", "breach")
      .limit(3);

    if (slaBreaches) {
      urgentItems.push(...slaBreaches.map(s => ({
        id: s.id,
        type: "sla" as const,
        title: `SLA Breach: ${s.account}`,
        description: "Immediate action required",
        priority: "critical" as const,
      })));
    }
  } catch (error) {
    console.error("Error fetching urgent items:", error);
  }

  return urgentItems;
}

async function getApprovalQueue(userId: string) {
  const approvalQueue = [];

  try {
    // Pending auto-apply approvals
    const { data: autoApply } = await supabaseServer
      .from("approval_queue")
      .select("id, type, details, expires_at")
      .eq("user_id", userId)
      .eq("type", "auto_apply")
      .eq("approved", false)
      .limit(3);

    if (autoApply) {
      approvalQueue.push(...autoApply.map(a => ({
        id: a.id,
        type: "auto_apply" as const,
        title: "Auto-Apply Request",
        description: a.details?.description || "Review and approve auto-apply configuration",
        expiresAt: a.expires_at,
        requiresApproval: true,
      })));
    }

    // Pending pricing changes
    const { data: pricing } = await supabaseServer
      .from("approval_queue")
      .select("id, type, details, expires_at")
      .eq("user_id", userId)
      .eq("type", "pricing")
      .eq("approved", false)
      .limit(3);

    if (pricing) {
      approvalQueue.push(...pricing.map(p => ({
        id: p.id,
        type: "pricing" as const,
        title: "Pricing Change",
        description: `New rate: ${p.details?.newRate || "TBD"}`,
        expiresAt: p.expires_at,
        requiresApproval: true,
      })));
    }
  } catch (error) {
    console.error("Error fetching approval queue:", error);
  }

  return approvalQueue;
}

async function getSLAStatus(userId: string): Promise<MobileOperationsResponse["slaStatus"]> {
  try {
    const { data: slaData } = await supabaseServer
      .from("sla_metrics")
      .select("account, status, next_check_at")
      .eq("user_id", userId)
      .limit(10);

    return (
      slaData?.map(s => ({
        account: s.account,
        health: s.status === "breach" ? "breach" : s.status === "warning" ? "warning" : "healthy",
        nextCheckAt: s.next_check_at,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching SLA status:", error);
    return [];
  }
}

async function getDailyRevenueTrend(userId: string): Promise<MobileOperationsResponse["dailyRevenueTrend"]> {
  try {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Today's revenue
    const { data: todayTx } = await supabaseServer
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", today.toISOString());

    const todayRevenue = todayTx?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Yesterday's revenue
    const { data: yesterdayTx } = await supabaseServer
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", yesterday.toISOString())
      .lt("completed_at", today.toISOString());

    const yesterdayRevenue = yesterdayTx?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Week average
    const { data: weekTx } = await supabaseServer
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", weekAgo.toISOString());

    const weekRevenue = weekTx?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const weekAverage = Math.round(weekRevenue / 7);

    return {
      today: todayRevenue,
      yesterday: yesterdayRevenue,
      weekAverage,
      trend: todayRevenue > yesterdayRevenue ? "up" : todayRevenue < yesterdayRevenue ? "down" : "stable",
    };
  } catch (error) {
    console.error("Error fetching revenue trend:", error);
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

    if (!userId || !token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: tokenData, error: tokenError } =
      await supabaseServer.auth.getUser(token);

    if (tokenError || !tokenData.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (tokenData.user.id !== userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Fetch all operational data in parallel
    const [metrics, urgentItems, approvalQueue, slaStatus, revenueTrend] = await Promise.all([
      getOperationalMetrics(userId),
      getUrgentItems(userId),
      getApprovalQueue(userId),
      getSLAStatus(userId),
      getDailyRevenueTrend(userId),
    ]);

    const response: MobileOperationsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
      urgentItems,
      approvalQueue,
      slaStatus,
      dailyRevenueTrend: revenueTrend,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in mobile operations API:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
