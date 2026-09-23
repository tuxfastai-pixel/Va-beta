"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type OpsMetricsResponse = {
  success: boolean;
  asOf: string;
  agentKpis: {
    activeAgents: number;
    totalActions: number;
    failures: number;
    closeRate: number;
    averageResponseMs: number;
    byAgent: Array<{
      agentName: string;
      actions: number;
      failures: number;
      closeRate: number;
      revenueGenerated: number;
    }>;
  };
  systemHealth: {
    score: number;
    slaBreaches: number;
    eventStream: Array<{ title: string; detail: string; timestamp: string }>;
  };
  revenueMetrics: {
    totalRevenue: number;
    estimatedProfit: number;
    estimatedMargin: number;
  };
  pipelineMetrics: {
    dealsInPipeline: number;
  };
};

type OpsForecastResponse = {
  success: boolean;
  revenue: {
    sevenDay: { projectedRevenue: number; confidence: number; trend: string };
    thirtyDay: { projectedRevenue: number; confidence: number; trend: string };
  };
  capacityRisk: {
    workloadSaturation: number;
    overloadRisk: number;
    slaBreachProbability: number;
    recommendation: string;
  };
  predictedChurn: Array<{
    clientName: string;
    riskScore: number;
    riskBand: "low" | "medium" | "high";
    nextBestAction: string;
  }>;
};

type OpsOptimizationResponse = {
  success: boolean;
  pricingAdjustments: Array<{ dealId: string; recommendedValue: number }>;
  platformPriorities: {
    topPlatform?: { platform: string; region: string; targetTrafficShare: number };
    allocations: Array<{ platform: string; region: string; targetTrafficShare: number; roiScore: number }>;
  };
  workloadRebalance: Array<{ workItemId: string; assignedAgent: string; confidence: number; reason: string }>;
};

type ChaosResponse = {
  success: boolean;
  resilienceScore?: number;
  highestImpactScenario?: string;
  results?: Array<{ scenario: string; impactScore: number; resilienceScore: number }>;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value: number): string {
  return `${Number(value || 0).toFixed(1)}%`;
}

function healthColor(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 65) return "text-amber-300";
  return "text-rose-300";
}

export default function OperationsLiveClient() {
  const [metrics, setMetrics] = useState<OpsMetricsResponse | null>(null);
  const [forecast, setForecast] = useState<OpsForecastResponse | null>(null);
  const [optimization, setOptimization] = useState<OpsOptimizationResponse | null>(null);
  const [chaos, setChaos] = useState<ChaosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [chaosRunning, setChaosRunning] = useState(false);
  const lowPriorityRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const [metricsRes, forecastRes, optimizationRes] = await Promise.all([
      fetch("/api/ops/metrics", { cache: "no-store" }),
      fetch("/api/ops/forecast", { cache: "no-store" }),
      fetch("/api/ops/optimization", { cache: "no-store" }),
    ]);

    if (metricsRes.ok) {
      const json = await metricsRes.json() as OpsMetricsResponse;
      setMetrics(json);
      setLastUpdated(json.asOf);
    }
    if (forecastRes.ok) {
      setForecast(await forecastRes.json() as OpsForecastResponse);
    }
    if (optimizationRes.ok) {
      setOptimization(await optimizationRes.json() as OpsOptimizationResponse);
    }

    setLoading(false);
  }, []);

  const scheduleLowPriorityRefresh = useCallback(() => {
    if (lowPriorityRefreshTimer.current) {
      return;
    }
    lowPriorityRefreshTimer.current = setTimeout(() => {
      lowPriorityRefreshTimer.current = null;
      void refresh();
    }, 10_000);
  }, [refresh]);

  const handleRealtimeEvent = useCallback((table: string, payload: Record<string, unknown>) => {
    const next = (payload.new as Record<string, unknown> | undefined) ?? {};
    const old = (payload.old as Record<string, unknown> | undefined) ?? {};

    const status = String(next.status ?? old.status ?? "").toLowerCase();
    const eventType = String(next.event_type ?? old.event_type ?? "").toLowerCase();
    const outcome = String(next.outcome ?? old.outcome ?? "").toLowerCase();
    const score = Number(next.score ?? (next.payload as Record<string, unknown> | undefined)?.score ?? 0);

    const highPriority =
      (table === "sla_records" && status === "overdue") ||
      (table === "invoices" && ["paid", "overdue"].includes(status)) ||
      (table === "agent_activities" && (outcome === "failure" || score >= 8)) ||
      (table === "audit_logs" && ["sla_missed", "payment_received", "payment_failed"].includes(eventType));

    if (highPriority) {
      void refresh();
      return;
    }

    scheduleLowPriorityRefresh();
  }, [refresh, scheduleLowPriorityRefresh]);

  useEffect(() => {
    const initialRefresh = setTimeout(() => {
      void refresh();
    }, 0);

    const poll = setInterval(() => {
      void refresh();
    }, 30_000);

    // Prioritized realtime path: critical alerts refresh immediately, low-priority updates are batched.
    const channel = supabase
      .channel("ops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_activities" }, (payload) => handleRealtimeEvent("agent_activities", payload as unknown as Record<string, unknown>))
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_analytics" }, (payload) => handleRealtimeEvent("revenue_analytics", payload as unknown as Record<string, unknown>))
      .on("postgres_changes", { event: "*", schema: "public", table: "sla_records" }, (payload) => handleRealtimeEvent("sla_records", payload as unknown as Record<string, unknown>))
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, (payload) => handleRealtimeEvent("invoices", payload as unknown as Record<string, unknown>))
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, (payload) => handleRealtimeEvent("audit_logs", payload as unknown as Record<string, unknown>))
      .subscribe();

    return () => {
      clearTimeout(initialRefresh);
      clearInterval(poll);
      if (lowPriorityRefreshTimer.current) {
        clearTimeout(lowPriorityRefreshTimer.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [handleRealtimeEvent, refresh]);

  const runChaosSuite = useCallback(async () => {
    setChaosRunning(true);
    try {
      const res = await fetch("/api/ops/chaos", { cache: "no-store" });
      if (res.ok) {
        setChaos(await res.json() as ChaosResponse);
      }
    } finally {
      setChaosRunning(false);
    }
  }, []);

  const topAgent = metrics?.agentKpis.byAgent?.[0];
  const topChurn = useMemo(() => (forecast?.predictedChurn || []).slice(0, 3), [forecast]);

  if (loading) {
    return <main className="p-10 text-sm text-slate-200">Loading live operations intelligence...</main>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_38%),linear-gradient(180deg,_#0b1120_0%,_#131b2e_42%,_#f8fafc_42%,_#f8fafc_100%)] text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-6 py-10 lg:px-10">
        <section className="rounded-3xl border border-white/15 bg-slate-900/75 p-8 shadow-2xl shadow-emerald-950/20 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">
                Phase 8 Live Autonomy
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Operational Intelligence Runtime</h1>
              <p className="text-sm text-slate-300">Observe, predict, adapt, optimize, and recover continuously. Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "unknown"}</p>
            </div>
            <button
              type="button"
              onClick={() => void runChaosSuite()}
              disabled={chaosRunning}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {chaosRunning ? "Running Chaos Suite..." : "Run Chaos Suite"}
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Card label="Agents active" value={String(metrics?.agentKpis.activeAgents || 0)} />
          <Card label="Deals in pipeline" value={String(metrics?.pipelineMetrics.dealsInPipeline || 0)} />
          <Card label="SLA breaches" value={String(metrics?.systemHealth.slaBreaches || 0)} />
          <Card label="Revenue (7d forecast)" value={formatCurrency(forecast?.revenue.sevenDay.projectedRevenue || 0)} />
          <Card label="Conversion rate" value={formatPercent(metrics?.agentKpis.closeRate || 0)} />
          <Card label="System health" value={String(metrics?.systemHealth.score || 0)} accent={healthColor(metrics?.systemHealth.score || 0)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Forecast intelligence" subtitle="Revenue horizon, churn risk, and capacity pressure.">
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallStat label="7-day revenue" value={formatCurrency(forecast?.revenue.sevenDay.projectedRevenue || 0)} />
              <SmallStat label="30-day revenue" value={formatCurrency(forecast?.revenue.thirtyDay.projectedRevenue || 0)} />
              <SmallStat label="Forecast confidence" value={formatPercent(forecast?.revenue.sevenDay.confidence || 0)} />
              <SmallStat label="SLA breach probability" value={formatPercent(forecast?.capacityRisk.slaBreachProbability || 0)} />
            </div>
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{forecast?.capacityRisk.recommendation || "No recommendation yet."}</p>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Predicted churn (top risk)</p>
              {(topChurn.length === 0) ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No high-risk clients detected.</p>
              ) : topChurn.map((client) => (
                <div key={client.clientName} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold">{client.clientName} â€¢ {client.riskBand.toUpperCase()} ({client.riskScore})</p>
                  <p className="text-slate-500">{client.nextBestAction}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Optimization actions" subtitle="Pricing, platform allocation, and workload balancing.">
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallStat label="Pricing adjustments" value={String(optimization?.pricingAdjustments.length || 0)} />
              <SmallStat label="Workload assignments" value={String(optimization?.workloadRebalance.length || 0)} />
              <SmallStat label="Top platform" value={optimization?.platformPriorities.topPlatform?.platform || "n/a"} />
              <SmallStat label="Target share" value={formatPercent(optimization?.platformPriorities.topPlatform?.targetTrafficShare || 0)} />
            </div>
            <div className="mt-4 space-y-2">
              {(optimization?.workloadRebalance || []).slice(0, 4).map((assignment) => (
                <div key={assignment.workItemId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold">{assignment.assignedAgent} â€¢ confidence {assignment.confidence}%</p>
                  <p className="text-slate-500">{assignment.reason}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Agent leaderboard" subtitle="Revenue-linked performance and failures.">
            <div className="space-y-2">
              {(metrics?.agentKpis.byAgent || []).slice(0, 6).map((agent) => (
                <div key={agent.agentName} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold">{agent.agentName} â€¢ {formatCurrency(agent.revenueGenerated)}</p>
                  <p className="text-slate-500">{agent.actions} actions â€¢ {agent.failures} failures â€¢ {agent.closeRate}% close rate</p>
                </div>
              ))}
              {!topAgent && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No agent activity found.</p>}
            </div>
          </Panel>

          <Panel title="Live event stream" subtitle="Realtime system and workflow events.">
            <div className="space-y-2">
              {(metrics?.systemHealth.eventStream || []).slice(0, 8).map((event) => (
                <div key={`${event.title}-${event.timestamp}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-slate-500">{event.detail}</p>
                  <p className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        {chaos?.results && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-lg">
            <h2 className="text-xl font-black text-slate-950">Chaos validation results</h2>
            <p className="mt-1 text-sm text-slate-500">Nightly resilience simulation categories available in API and workflows.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Resilience score</p>
                <p className="mt-1 text-xl font-black text-slate-950">{chaos.resilienceScore ?? "n/a"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Highest impact scenario</p>
                <p className="mt-1 text-lg font-black text-slate-950">{chaos.highestImpactScenario ?? "unknown"}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {chaos.results.map((row) => (
                <div key={row.scenario} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-950">{row.scenario}</p>
                  <p className="text-slate-500">Impact {row.impactScore}</p>
                  <p className="text-slate-500">Resilience {row.resilienceScore}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Panel(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-lg shadow-slate-900/5">
      <h2 className="text-xl font-black text-slate-950">{props.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function Card(props: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-slate-900/60 p-4 shadow-lg shadow-black/20 backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">{props.label}</p>
      <p className={`mt-2 text-2xl font-black ${props.accent || "text-white"}`}>{props.value}</p>
    </div>
  );
}

function SmallStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{props.value}</p>
    </div>
  );
}
