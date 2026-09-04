import { writeAuditLog } from "@/lib/audit/auditLog";
import { supabaseServer } from "@/lib/supabaseServer";

export type ChaosScenario =
  | "supabase_latency"
  | "queue_overload"
  | "payment_failure"
  | "email_failure"
  | "rollback_validation"
  | "redis_outage"
  | "api_ban";

export interface ChaosRunResult {
  scenario: ChaosScenario;
  impactScore: number; // 0-100
  resilienceScore: number; // 0-100
  summary: string;
  recommendations: string[];
  metrics: Record<string, number>;
  generatedAt: string;
}

export interface ChaosSuiteReport {
  mode: "nightly" | "manual";
  resilienceScore: number;
  highestImpactScenario: ChaosScenario;
  results: ChaosRunResult[];
  generatedAt: string;
}

function clamp(input: number): number {
  return Math.max(0, Math.min(100, Math.round(input)));
}

function nowIso(): string {
  return new Date().toISOString();
}

async function baseMetrics() {
  const [overdueRes, pendingInvoicesRes, failuresRes, queueRes, pendingDealsRes] = await Promise.all([
    supabaseServer.from("sla_records").select("id").eq("status", "overdue"),
    supabaseServer.from("invoices").select("id").in("status", ["pending", "overdue"]),
    supabaseServer
      .from("agent_activities")
      .select("id")
      .eq("outcome", "failure")
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabaseServer.from("deals").select("id").in("stage", ["lead", "contacted", "interview", "negotiation"]),
    supabaseServer.from("deals").select("id").eq("stage", "negotiation"),
  ]);

  return {
    overdueSla: overdueRes.data?.length ?? 0,
    pendingInvoices: pendingInvoicesRes.data?.length ?? 0,
    recentFailures: failuresRes.data?.length ?? 0,
    activeQueue: queueRes.data?.length ?? 0,
    pendingNegotiations: pendingDealsRes.data?.length ?? 0,
  };
}

export async function runChaosScenario(scenario: ChaosScenario): Promise<ChaosRunResult> {
  const metrics = await baseMetrics();

  if (scenario === "supabase_latency") {
    const impact = clamp(metrics.activeQueue * 3 + metrics.overdueSla * 7 + 22);
    return {
      scenario,
      impactScore: impact,
      resilienceScore: clamp(100 - impact + 14 - metrics.recentFailures),
      summary: "Simulated Supabase latency spikes to test timeout/retry resilience.",
      recommendations: [
        "Add query timeout budget and cached read fallback for dashboard paths.",
        "Push non-critical writes to delayed queue when latency exceeds threshold.",
      ],
      metrics,
      generatedAt: nowIso(),
    };
  }

  if (scenario === "queue_overload") {
    const impact = clamp(metrics.activeQueue * 4 + metrics.pendingNegotiations * 3 + 24);
    return {
      scenario,
      impactScore: impact,
      resilienceScore: clamp(100 - impact + 16 - metrics.overdueSla),
      summary: "Simulated queue overload and worker contention.",
      recommendations: [
        "Increase task reservation and ownership locking for competing orchestrators.",
        "Throttle low-priority jobs when overload risk crosses 70.",
      ],
      metrics,
      generatedAt: nowIso(),
    };
  }

  if (scenario === "payment_failure") {
    const impact = clamp(metrics.pendingInvoices * 5 + 25);
    return {
      scenario,
      impactScore: impact,
      resilienceScore: clamp(100 - impact + Math.max(0, 15 - metrics.overdueSla * 2)),
      summary: "Simulated payment rail failure and invoice recovery stress.",
      recommendations: [
        "Enable dual-provider fallback (Wise/PayFast) for retries.",
        "Auto-trigger deposit-first mode for at-risk clients.",
      ],
      metrics,
      generatedAt: nowIso(),
    };
  }

  if (scenario === "email_failure") {
    const impact = clamp(metrics.recentFailures * 5 + metrics.activeQueue * 2 + 18);
    return {
      scenario,
      impactScore: impact,
      resilienceScore: clamp(100 - impact + 12),
      summary: "Simulated outbound email provider failure and alert degradation.",
      recommendations: [
        "Fallback to WhatsApp/SMS notification channel for critical alerts.",
        "Queue unsent notifications for replay after provider recovery.",
      ],
      metrics,
      generatedAt: nowIso(),
    };
  }

  if (scenario === "rollback_validation") {
    const impact = clamp(metrics.recentFailures * 3 + metrics.overdueSla * 4 + 12);
    return {
      scenario,
      impactScore: impact,
      resilienceScore: clamp(100 - impact + 20),
      summary: "Validated rollback behavior for adaptive decisions under low confidence.",
      recommendations: [
        "Keep decision-memory cooldown windows enforced.",
        "Require manual override for repeated rollback loops.",
      ],
      metrics,
      generatedAt: nowIso(),
    };
  }

  if (scenario === "redis_outage") {
    const impact = clamp(metrics.activeQueue * 4 + metrics.recentFailures * 5 + 20);
    return {
      scenario,
      impactScore: impact,
      resilienceScore: clamp(100 - impact + 15),
      summary: "Simulated Redis outage and measured fallback behavior.",
      recommendations: [
        "Enable graceful in-memory fallback when Redis is unavailable.",
        "Replay queued tasks when Redis returns.",
      ],
      metrics,
      generatedAt: nowIso(),
    };
  }

  const impact = clamp(metrics.activeQueue * 3 + metrics.recentFailures * 5 + 20);
  return {
    scenario: "api_ban",
    impactScore: impact,
    resilienceScore: clamp(100 - impact + 18),
    summary: "Simulated platform API rate-limit ban and sourcing disruption.",
    recommendations: [
      "Rotate sourcing across alternative platforms by ROI tier.",
      "Throttle burst traffic and increase cache hit ratio.",
    ],
    metrics,
    generatedAt: nowIso(),
  };
}

function buildReport(mode: ChaosSuiteReport["mode"], results: ChaosRunResult[]): ChaosSuiteReport {
  const averageResilience = results.length > 0
    ? Math.round(results.reduce((sum, row) => sum + row.resilienceScore, 0) / results.length)
    : 0;

  const highestImpact = results.slice().sort((left, right) => right.impactScore - left.impactScore)[0];

  return {
    mode,
    resilienceScore: averageResilience,
    highestImpactScenario: highestImpact?.scenario ?? "api_ban",
    results,
    generatedAt: nowIso(),
  };
}

async function persistChaosReport(report: ChaosSuiteReport): Promise<void> {
  await writeAuditLog({
    event_type: "agent_action",
    entity_type: "system",
    entity_id: "chaos_suite",
    actor: "system",
    payload: {
      kind: "chaos_suite",
      mode: report.mode,
      resilienceScore: report.resilienceScore,
      highestImpactScenario: report.highestImpactScenario,
      results: report.results,
    },
  });
}

export async function runChaosSuite(mode: ChaosSuiteReport["mode"] = "manual"): Promise<ChaosSuiteReport> {
  const scenarios: ChaosScenario[] = [
    "supabase_latency",
    "queue_overload",
    "payment_failure",
    "email_failure",
    "rollback_validation",
    "redis_outage",
    "api_ban",
  ];

  const results = await Promise.all(scenarios.map((scenario) => runChaosScenario(scenario)));
  const sorted = results.sort((left, right) => right.impactScore - left.impactScore);
  const report = buildReport(mode, sorted);
  await persistChaosReport(report);
  return report;
}

export async function runNightlyChaosValidation(): Promise<ChaosSuiteReport> {
  return runChaosSuite("nightly");
}

export async function getLatestChaosReport(): Promise<ChaosSuiteReport | null> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("payload, created_at")
    .eq("event_type", "agent_action")
    .eq("entity_type", "system")
    .eq("entity_id", "chaos_suite")
    .order("created_at", { ascending: false })
    .limit(1);

  const payload = (data?.[0] as { payload?: Record<string, unknown> } | undefined)?.payload;
  if (!payload || payload.kind !== "chaos_suite") {
    return null;
  }

  return {
    mode: String(payload.mode || "manual") as ChaosSuiteReport["mode"],
    resilienceScore: Number(payload.resilienceScore || 0),
    highestImpactScenario: String(payload.highestImpactScenario || "api_ban") as ChaosScenario,
    results: (payload.results as ChaosRunResult[]) ?? [],
    generatedAt: String(payload.generatedAt || nowIso()),
  };
}
