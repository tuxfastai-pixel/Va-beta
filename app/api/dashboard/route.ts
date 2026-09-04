import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth/serverAuth";
import { supabaseServer } from "@/lib/supabaseServer";

function isRecoverableDashboardError(message: string | undefined) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("column") ||
    text.includes("schema cache")
  );
}

type TableCountResult = {
  count: number;
  available: boolean;
};

async function safeCount(table: string): Promise<TableCountResult> {
  const { count, error } = await supabaseServer
    .from(table)
    .select("id", { count: "exact", head: true });

  if (!error) {
    return { count: Number(count || 0), available: true };
  }

  if (isRecoverableDashboardError(error.message)) {
    return { count: 0, available: false };
  }

  throw new Error(error.message);
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function buildFounderInsights() {
  const [
    usersRegistered,
    applicationsSubmitted,
    interviewSessions,
    trustRecords,
    equilibriumEvents,
    runtimeSnapshots,
    aiSessions,
  ] = await Promise.all([
    safeCount("client_users"),
    safeCount("applications"),
    safeCount("interview_sessions"),
    safeCount("trust_history_records"),
    safeCount("equilibrium_events"),
    safeCount("runtime_snapshots"),
    safeCount("ai_memory"),
  ]);

  const careerProfilesRes = await supabaseServer
    .from("career_profiles")
    .select("id, user_id, intake, profile")
    .order("created_at", { ascending: false })
    .limit(100);

  const jobsRes = await supabaseServer
    .from("jobs")
    .select("id, title, match_score")
    .order("created_at", { ascending: false })
    .limit(100);

  const usersRes = await supabaseServer
    .from("client_users")
    .select("id, email, name, role")
    .order("created_at", { ascending: true })
    .limit(3);

  if (careerProfilesRes.error && !isRecoverableDashboardError(careerProfilesRes.error.message)) {
    throw new Error(careerProfilesRes.error.message);
  }

  if (jobsRes.error && !isRecoverableDashboardError(jobsRes.error.message)) {
    throw new Error(jobsRes.error.message);
  }

  if (usersRes.error && !isRecoverableDashboardError(usersRes.error.message)) {
    throw new Error(usersRes.error.message);
  }

  const profileRows = careerProfilesRes.error && isRecoverableDashboardError(careerProfilesRes.error.message)
    ? []
    : (Array.isArray(careerProfilesRes.data) ? careerProfilesRes.data : []);

  const jobRows = jobsRes.error && isRecoverableDashboardError(jobsRes.error.message)
    ? []
    : (Array.isArray(jobsRes.data) ? jobsRes.data : []);

  const userRows = usersRes.error && isRecoverableDashboardError(usersRes.error.message)
    ? []
    : (Array.isArray(usersRes.data) ? usersRes.data : []);

  const profilesCompleted = profileRows.length;
  const cvsUploaded = profileRows.filter((row) => {
    const intake = (row as { intake?: unknown }).intake as { resumeText?: string } | undefined;
    return typeof intake?.resumeText === "string" && intake.resumeText.trim().length > 0;
  }).length;

  const paymentScores = profileRows
    .map((row) => {
      const profile = (row as { profile?: unknown }).profile as { internationalPaymentReadinessScore?: unknown } | undefined;
      return Number(profile?.internationalPaymentReadinessScore ?? NaN);
    })
    .filter((value) => Number.isFinite(value));

  const paymentReady = paymentScores.filter((score) => score >= 75).length;
  const paymentImproving = paymentScores.filter((score) => score >= 40 && score < 75).length;
  const paymentNeedsSetup = paymentScores.filter((score) => score < 40).length;

  const matchScores = jobRows
    .map((row) => Number((row as { match_score?: unknown }).match_score ?? NaN))
    .filter((value) => Number.isFinite(value));

  const averageMatchScore = matchScores.length > 0
    ? matchScores.reduce((sum, value) => sum + value, 0) / matchScores.length
    : 0;

  const pilotUsers = userRows.map((row) => {
    const typed = row as { id: string; name?: string | null; email?: string | null; role?: string | null };
    const hasProfile = profileRows.some((profile) => String((profile as { user_id?: string | null }).user_id || "") === typed.id);
    const isFounder = String(typed.role || "").toLowerCase() === "founder";
    return {
      name: typed.name || typed.email || "Pilot User",
      status: isFounder ? "Completed" : hasProfile ? "Completed" : "Waiting",
      founder: isFounder,
    };
  });

  return {
    pilotStatus: {
      usersRegistered: usersRegistered.count,
      profilesCompleted,
      cvsUploaded,
      applicationsSubmitted: applicationsSubmitted.count,
      interviewSessions: interviewSessions.count,
    },
    systemHealth: {
      supabase: usersRegistered.available,
      ai: Boolean(process.env.OPENAI_API_KEY),
      telemetry: equilibriumEvents.available,
      jobsApi: !jobsRes.error,
    },
    pilotMetrics: {
      targetUsers: 3,
      users: pilotUsers,
    },
    observability: {
      governanceHealth: trustRecords.available ? "Stable" : "Degraded",
      trustHeat: toPercent(trustRecords.count * 7),
      replayStatus: runtimeSnapshots.available ? "Ready" : "Unavailable",
      equilibrium: equilibriumEvents.available ? "Balanced" : "No telemetry",
      activeAiSessions: aiSessions.count,
      recommendationQuality: toPercent(averageMatchScore),
      interviewCoachUsage: interviewSessions.count,
      paymentReadinessDistribution: {
        ready: paymentReady,
        improving: paymentImproving,
        needsSetup: paymentNeedsSetup,
      },
    },
  };
}

export async function GET() {
  const auth = await requireAdminRole();

  if ("response" in auth) {
    return auth.response;
  }
  const [jobsRes, invoicesRes, founderInsightsResult] = await Promise.all([
    supabaseServer
      .from("jobs")
      .select("id, title, company, match_score, pay_amount, currency, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseServer
      .from("invoices")
      .select("id, description, amount, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    buildFounderInsights().then((data) => ({ data, error: null as string | null })).catch((error: unknown) => ({
      data: {
        pilotStatus: {
          usersRegistered: 0,
          profilesCompleted: 0,
          cvsUploaded: 0,
          applicationsSubmitted: 0,
          interviewSessions: 0,
        },
        systemHealth: {
          supabase: false,
          ai: Boolean(process.env.OPENAI_API_KEY),
          telemetry: false,
          jobsApi: false,
        },
        pilotMetrics: {
          targetUsers: 3,
          users: [],
        },
        observability: {
          governanceHealth: "Unavailable",
          trustHeat: 0,
          replayStatus: "Unavailable",
          equilibrium: "Unavailable",
          activeAiSessions: 0,
          recommendationQuality: 0,
          interviewCoachUsage: 0,
          paymentReadinessDistribution: {
            ready: 0,
            improving: 0,
            needsSetup: 0,
          },
        },
      },
      error: error instanceof Error ? error.message : "Failed to load founder insights",
    })),
  ]);

  if (jobsRes.error || invoicesRes.error) {
    const jobsRecoverable = isRecoverableDashboardError(jobsRes.error?.message);
    const invoicesRecoverable = isRecoverableDashboardError(invoicesRes.error?.message);

    if (jobsRecoverable || invoicesRecoverable) {
      return NextResponse.json({
        jobs: jobsRecoverable ? [] : jobsRes.data || [],
        invoices: invoicesRecoverable ? [] : invoicesRes.data || [],
        founderInsights: founderInsightsResult.data,
        warning: jobsRes.error?.message || invoicesRes.error?.message || founderInsightsResult.error || undefined,
      });
    }

    return NextResponse.json(
      { error: jobsRes.error?.message || invoicesRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobs: jobsRes.data || [],
    invoices: invoicesRes.data || [],
    founderInsights: founderInsightsResult.data,
    warning: founderInsightsResult.error || undefined,
  });
}
