"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { predictFatigue, type FatigueInputs, type FatiguePrediction } from "@/lib/ui/predictiveFatigueModel";

type DashboardData = {
  jobs: Array<{ id: string; title: string; status?: string; created_at?: string }>;
  invoices: Array<{ id: string; amount?: number | null; status?: string; created_at?: string }>;
  founderInsights?: FounderInsights;
};

type FounderInsights = {
  pilotStatus: {
    usersRegistered: number;
    profilesCompleted: number;
    cvsUploaded: number;
    applicationsSubmitted: number;
    interviewSessions: number;
  };
  systemHealth: {
    supabase: boolean;
    ai: boolean;
    telemetry: boolean;
    jobsApi: boolean;
  };
  pilotMetrics: {
    targetUsers: number;
    users: Array<{ name: string; status: string; founder: boolean }>;
  };
  observability: {
    governanceHealth: string;
    trustHeat: number;
    replayStatus: string;
    equilibrium: string;
    activeAiSessions: number;
    recommendationQuality: number;
    interviewCoachUsage: number;
    paymentReadinessDistribution: {
      ready: number;
      improving: number;
      needsSetup: number;
    };
  };
};

type PortalMode = "founder" | "client";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  founderEnabled?: boolean;
};

type InteractionModeState = {
  prediction: FatiguePrediction;
  inputs: FatigueInputs;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getMostRecentTimestamp(items: Array<{ created_at?: string }>): number {
  const timestamps = items
    .map((item) => (item.created_at ? Date.parse(item.created_at) : NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return Date.now();
  }

  return Math.max(...timestamps);
}

function buildFatigueInputs(data: DashboardData | null): FatigueInputs {
  const jobs = data?.jobs || [];
  const invoices = data?.invoices || [];
  const combinedCount = jobs.length + invoices.length;
  const recentTimestamp = getMostRecentTimestamp([...jobs, ...invoices]);
  const hoursSinceLastActivity = Math.max(0, (Date.now() - recentTimestamp) / 3_600_000);

  const pendingJobs = jobs.filter((job) => {
    const status = String(job.status || "").toLowerCase();
    return !status || status === "pending" || status === "needs_review" || status === "revision";
  }).length;

  const unpaidInvoices = invoices.filter((invoice) => {
    const status = String(invoice.status || "").toLowerCase();
    return !status || status === "open" || status === "pending" || status === "overdue";
  }).length;

  const ignoredNotificationRate = clamp01((pendingJobs + unpaidInvoices) / Math.max(1, combinedCount + 2));
  const actionDelayTrend = clamp01(hoursSinceLastActivity / 72);
  const refinementLoopCount = Math.min(10, pendingJobs + Math.max(0, combinedCount - 1));
  const sessionVolatility = clamp01(Math.abs(pendingJobs - unpaidInvoices) / Math.max(1, combinedCount));
  const interruptionSensitivity = clamp01((pendingJobs + unpaidInvoices) / Math.max(1, combinedCount + 1));
  const recoveryFrequency = clamp01((jobs.filter((job) => String(job.status || "").toLowerCase() === "completed").length + invoices.filter((invoice) => String(invoice.status || "").toLowerCase() === "paid").length) / Math.max(1, combinedCount + 1));

  return {
    ignoredNotificationRate,
    actionDelayTrend,
    refinementLoopCount,
    sessionVolatility,
    interruptionSensitivity,
    recoveryFrequency,
  };
}

function interactionModeLabel(mode: FatiguePrediction["recommendedInteractionMode"]): string {
  if (mode === "normal") return "Normal cadence";
  if (mode === "reduced") return "Reduced cadence";
  if (mode === "quiet") return "Quiet mode";
  return "Recovery mode";
}

export default function ClientPortal() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interactionMode, setInteractionMode] = useState<InteractionModeState | null>(null);
  const [portalMode, setPortalMode] = useState<PortalMode>("client");
  const router = useRouter();
  const safeData: DashboardData = {
    jobs: Array.isArray(data?.jobs) ? data.jobs : [],
    invoices: Array.isArray(data?.invoices) ? data.invoices : [],
    founderInsights: data?.founderInsights,
  };
  const normalizedRole = String(user?.role || "").trim().toLowerCase();
  const isFounder = Boolean(user?.founderEnabled) || ["founder", "admin", "owner", "super_admin"].includes(normalizedRole);
  const activeMode: PortalMode = isFounder ? portalMode : "client";
  const founderInsights = safeData.founderInsights;
  const visibleJobs = safeData.jobs.filter((job) => {
    if (activeMode !== "founder") return true;
    const title = String(job.title || "").toLowerCase();
    const isSeededPlaceholder =
      title.includes("crm system setup") ||
      title.includes("demo") ||
      title.includes("placeholder") ||
      title.includes("seeded") ||
      title.includes("test job") ||
      title.startsWith("i want to be ") ||
      title.includes("virtual assiatant") ||
      title.includes("virtual assistant and crm manager") ||
      title.includes("crm manager") && title.includes("i want");

    return !isSeededPlaceholder;
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        const authRes = await fetch("/api/auth/me", { credentials: "include" });

        if (!authRes.ok) {
          router.push("/login");
          return;
        }

        const authData = (await authRes.json().catch(() => ({}))) as {
          user?: User;
          onboardingCompleted?: boolean;
          redirectTo?: string;
        };
        if (!authData.user) {
          router.push("/login");
          return;
        }

        if (authData.redirectTo) {
          const targetIsClientPortal = authData.redirectTo.startsWith("/client-portal");
          if (!targetIsClientPortal) {
            router.push(authData.redirectTo);
            return;
          }

          if (typeof window !== "undefined") {
            const currentPath = `${window.location.pathname}${window.location.search}`;
            if (authData.redirectTo !== currentPath) {
              // Normalize self-target redirects (e.g. query-based mode changes)
              // without short-circuiting user initialization.
              router.replace(authData.redirectTo);
            }
          }
        }

        if (!Boolean(authData.onboardingCompleted) && !Boolean(authData.user.founderEnabled)) {
          router.push("/onboarding");
          return;
        }

        setUser(authData.user);
        const role = String(authData?.user?.role || "").trim().toLowerCase();
        const founderRequested =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("mode") === "founder"
            : false;
        if (
          founderRequested ||
          Boolean(authData?.user?.founderEnabled) ||
          ["founder", "admin", "owner", "super_admin"].includes(role)
        ) {
          setPortalMode("founder");
        }

        // Fetch dashboard data
        const dashRes = await fetch("/api/dashboard");
        const dashData = (await dashRes.json().catch(() => ({}))) as Partial<DashboardData>;
        const normalizedDashboardData: DashboardData = {
          jobs: Array.isArray(dashData?.jobs) ? dashData.jobs : [],
          invoices: Array.isArray(dashData?.invoices) ? dashData.invoices : [],
          founderInsights:
            dashData?.founderInsights && typeof dashData.founderInsights === "object"
              ? (dashData.founderInsights as FounderInsights)
              : undefined,
        };
        setData(normalizedDashboardData);

        const fatigueInputs = buildFatigueInputs(normalizedDashboardData);
        setInteractionMode({
          inputs: fatigueInputs,
          prediction: predictFatigue(fatigueInputs),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading portal");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#0f0f0f", color: "#ffffff" }}>
        Loading...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ padding: 40, color: "#ffffff", backgroundColor: "#0f0f0f", minHeight: "100vh" }}>
        <p>{error || "Not authenticated"}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f0f0f", color: "#ffffff" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 40px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {activeMode === "founder" ? "VA-Beta Founder Console" : "Client Portal"}
          </h1>
          <p style={{ margin: "8px 0 0 0", color: "#888", fontSize: 14 }}>Welcome, {user.name}</p>
          {isFounder && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.2 }}>View Mode</span>
              <button
                type="button"
                onClick={() => setPortalMode("founder")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: portalMode === "founder" ? "1px solid #10b981" : "1px solid #334155",
                  backgroundColor: portalMode === "founder" ? "rgba(16,185,129,0.18)" : "transparent",
                  color: "#ffffff",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Founder View
              </button>
              <button
                type="button"
                onClick={() => setPortalMode("client")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: portalMode === "client" ? "1px solid #93c5fd" : "1px solid #334155",
                  backgroundColor: portalMode === "client" ? "rgba(59,130,246,0.18)" : "transparent",
                  color: "#ffffff",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Client View
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            fontSize: 14,
            backgroundColor: "#374151",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={{ padding: "40px", maxWidth: 1200, margin: "0 auto" }}>
        {activeMode === "founder" && founderInsights && (
          <div style={{ marginBottom: 32, display: "grid", gap: 16 }}>
            <div style={{ padding: 20, borderRadius: 14, backgroundColor: "#111827", border: "1px solid #233045" }}>
              <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>Platform</h2>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div>Users Registered: <strong>{founderInsights.pilotStatus.usersRegistered}</strong></div>
                <div>Profiles Completed: <strong>{founderInsights.pilotStatus.profilesCompleted}</strong></div>
                <div>CVs Uploaded: <strong>{founderInsights.pilotStatus.cvsUploaded}</strong></div>
                <div>Applications Submitted: <strong>{founderInsights.pilotStatus.applicationsSubmitted}</strong></div>
                <div>Interview Sessions: <strong>{founderInsights.pilotStatus.interviewSessions}</strong></div>
              </div>
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13 }}>
                <span>Supabase {founderInsights.systemHealth.supabase ? "✓" : "⚠"}</span>
                <span>AI {founderInsights.systemHealth.ai ? "✓" : "⚠"}</span>
                <span>Telemetry {founderInsights.systemHealth.telemetry ? "✓" : "⚠"}</span>
                <span>Jobs API {founderInsights.systemHealth.jobsApi ? "✓" : "⚠"}</span>
              </div>
            </div>

            <div style={{ padding: 20, borderRadius: 14, backgroundColor: "#111827", border: "1px solid #233045" }}>
              <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>Pilot Metrics</h2>
              <p style={{ marginTop: 0, color: "#94a3b8", fontSize: 13 }}>
                {founderInsights.pilotMetrics.users.length}/{founderInsights.pilotMetrics.targetUsers} user pilot
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {founderInsights.pilotMetrics.users.map((pilotUser) => (
                  <div key={pilotUser.name} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{pilotUser.founder ? "Founder" : pilotUser.name}</span>
                    <span style={{ color: pilotUser.status === "Completed" ? "#34d399" : "#fbbf24" }}>{pilotUser.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 20, borderRadius: 14, backgroundColor: "#111827", border: "1px solid #233045" }}>
              <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>AI Observatory</h2>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div>Governance Health: <strong>{founderInsights.observability.governanceHealth}</strong></div>
                <div>Trust Heat: <strong>{founderInsights.observability.trustHeat}%</strong></div>
                <div>Replay Status: <strong>{founderInsights.observability.replayStatus}</strong></div>
                <div>Equilibrium: <strong>{founderInsights.observability.equilibrium}</strong></div>
                <div>Active AI Sessions: <strong>{founderInsights.observability.activeAiSessions}</strong></div>
                <div>Recommendation Quality: <strong>{founderInsights.observability.recommendationQuality}%</strong></div>
                <div>Interview Coach Usage: <strong>{founderInsights.observability.interviewCoachUsage}</strong></div>
                <div>
                  Payment Readiness Distribution: <strong>
                    {founderInsights.observability.paymentReadinessDistribution.ready}/{founderInsights.observability.paymentReadinessDistribution.improving}/{founderInsights.observability.paymentReadinessDistribution.needsSetup}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interaction Mode */}
        <div
          style={{
            marginBottom: 40,
            padding: 24,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(17,24,39,0.95), rgba(8,47,73,0.92))",
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#93c5fd" }}>
                Predictive cadence
              </p>
              <h2 style={{ margin: "8px 0 6px 0", fontSize: 24, fontWeight: 700 }}>
                {interactionMode ? interactionModeLabel(interactionMode.prediction.recommendedInteractionMode) : "Normal cadence"}
              </h2>
              <p style={{ margin: 0, color: "#cbd5e1", maxWidth: 720, lineHeight: 1.6 }}>
                The portal is adapting its guidance rhythm before overload builds up. When fatigue risk rises, the interface becomes calmer, batches more, and reduces interruptions early.
              </p>
            </div>

            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Fatigue risk</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc" }}>
                {interactionMode ? `${Math.round(interactionMode.prediction.fatigueRisk * 100)}%` : "--"}
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "#cbd5e1" }}>
                Predicted overload window: {interactionMode ? `${interactionMode.prediction.predictedOverloadWindow}h` : "--"}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: interactionMode?.prediction.proactiveDownshiftRequired ? "#fbbf24" : "#34d399" }}>
                {interactionMode?.prediction.proactiveDownshiftRequired ? "Proactive downshift active" : "No downshift required"}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ padding: 14, borderRadius: 12, backgroundColor: "rgba(15,23,42,0.7)" }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Ignored rate</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{interactionMode ? `${Math.round(interactionMode.inputs.ignoredNotificationRate * 100)}%` : "--"}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, backgroundColor: "rgba(15,23,42,0.7)" }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Delay trend</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{interactionMode ? `${Math.round(interactionMode.inputs.actionDelayTrend * 100)}%` : "--"}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, backgroundColor: "rgba(15,23,42,0.7)" }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Recommended mode</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{interactionMode ? interactionMode.prediction.recommendedInteractionMode : "--"}</div>
            </div>
          </div>
        </div>

        {/* Jobs Section */}
        <div style={{ marginBottom: 60 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
            {activeMode === "founder" ? "Your Personal Career" : "Active Jobs"}
          </h2>

          {visibleJobs.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {visibleJobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: 20,
                    backgroundColor: "#1a1a1a",
                    borderRadius: 8,
                    border: "1px solid #333",
                  }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px 0" }}>
                    {job.title}
                  </h3>
                  {job.status && (
                    <p style={{ margin: 0, fontSize: 13, color: "#10b981" }}>
                      Status: {job.status}
                    </p>
                  )}
                  {job.created_at && (
                    <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#888" }}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#888" }}>
              {activeMode === "founder"
                ? "No live recommendations yet. Synchronizing remote platforms..."
                : "No active jobs"}
            </p>
          )}
        </div>

        {/* Invoices Section */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Invoices</h2>

          {safeData.invoices.length > 0 ? (
            <div style={{ backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottomColor: "#333", borderBottomWidth: 1, borderBottomStyle: "solid" }}>
                    <th style={{ padding: 16, textAlign: "left", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: 16, textAlign: "left", fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: 16, textAlign: "left", fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {safeData.invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{ borderTopColor: "#333", borderTopWidth: 1, borderTopStyle: "solid" }}
                    >
                      <td style={{ padding: 16, fontSize: 14 }}>
                        {inv.created_at
                          ? new Date(inv.created_at).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td style={{ padding: 16, fontSize: 14, fontWeight: 600 }}>
                        ${Number(inv.amount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: 16, fontSize: 14, color: "#10b981" }}>
                        {inv.status || "Paid"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#888" }}>No invoices</p>
          )}
        </div>
      </div>
    </div>
  );
}
