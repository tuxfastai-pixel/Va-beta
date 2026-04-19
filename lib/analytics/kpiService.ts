import { buildRevenueProjection, getDailyTarget, getScalingPhase } from "@/lib/analytics/conversionKpi";
import { supabaseServer } from "@/lib/supabaseServer";

type LearningEventRow = {
  user_id?: string | null;
  event_type?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

function startOfTodayISO() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function startOfLast30DaysISO() {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function phaseLabel(phase: string) {
  switch (phase) {
    case "validation":
      return "Validation";
    case "optimization":
    case "controlled_scale":
      return "Scaling";
    default:
      return "Growth";
  }
}

export async function getUserKPI(userId: string) {
  const todayStart = startOfTodayISO();
  const monthStart = startOfLast30DaysISO();

  const [{ data: todayRows, error: todayError }, { data: monthlyRows, error: monthlyError }] = await Promise.all([
    supabaseServer
      .from("learning_events")
      .select("user_id, event_type, metadata, created_at")
      .eq("user_id", userId)
      .gte("created_at", todayStart),
    supabaseServer
      .from("learning_events")
      .select("user_id, event_type, metadata, created_at")
      .gte("created_at", monthStart),
  ]);

  if (todayError || monthlyError) {
    return {
      applications: 0,
      replies: 0,
      conversions: 0,
      revenue: 0,
      win_rate: 0,
      current_phase: "Validation",
      phase_detail: getScalingPhase({ users: 1, totalConversions: 0 }),
      target: getDailyTarget(),
      projection: buildRevenueProjection(5),
    };
  }

  const today = (todayRows || []) as LearningEventRow[];
  const month = (monthlyRows || []) as LearningEventRow[];

  const applications = today.filter((event) => event.event_type === "proposal_sent").length;
  const replies = today.filter((event) => event.event_type === "client_reply").length;
  const conversions = today.filter((event) => event.event_type === "job_won").length;
  const revenue = today
    .filter((event) => event.event_type === "job_won")
    .reduce((sum, event) => {
      const amount = Number(event.metadata?.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

  const activeUsers = new Set(
    month
      .map((event) => String(event.user_id || "").trim())
      .filter(Boolean)
  ).size;

  const monthlyWins = month.filter((event) => event.event_type === "job_won").length;
  const scaling = getScalingPhase({ users: Math.max(1, activeUsers), totalConversions: monthlyWins });

  return {
    applications,
    replies,
    conversions,
    revenue,
    win_rate: applications > 0 ? Number(((conversions / applications) * 100).toFixed(1)) : 0,
    current_phase: phaseLabel(scaling.phase),
    phase_detail: scaling,
    target: getDailyTarget(),
    projection: buildRevenueProjection(Math.max(5, activeUsers || 1)),
  };
}
