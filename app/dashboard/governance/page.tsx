"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type GovernanceState = {
  orchestratorPaused: boolean;
  forcedPricingReset: boolean;
  frozenModules: Record<"pricing" | "platform" | "workload" | "reinforcement", boolean>;
  workloadOverride: {
    enabled: boolean;
    assignments: Array<{ workItemId: string; assignedAgent: string; reason?: string }>;
  };
  updatedAt: string;
  updatedBy: string;
  reason: string;
};

type GovernancePayload = {
  success: boolean;
  asOf: string;
  state: GovernanceState;
  telemetry?: {
    primaryActiveIdentity: null | {
      userId: string;
      label: string;
      confidence: number;
      stability: number;
      specialization: string;
    };
    resumeVariantLeaderboard: Array<{
      variant: string;
      callbackRate: number;
      interviewRate: number;
      conversionRate: number;
      averageScore: number;
      support: number;
    }>;
    realismTrend: Array<{
      userId: string;
      resumeRealism: number;
      profileConfidenceScore: number;
      resumeDeploymentThrottle: number;
      identityStability: number;
      updatedAt: string;
    }>;
    interviewAlignmentTrend: Array<{
      userId: string;
      alignmentScore: number;
      meetingStage: string;
      intent: string;
      terminology: string[];
      workflowHints: string[];
      updatedAt: string;
    }>;
    cohesionTrend: Array<{
      userId: string;
      identityCohesion: number;
      divergenceRisk: number;
      consistency: number;
      believability: number;
      updatedAt: string;
    }>;
    honestyInterventions: Array<{
      userId: string;
      type: string;
      message: string;
      updatedAt: string;
    }>;
    positioningMemoryViewer: Array<{
      userId: string;
      primaryIdentity: string;
      primarySpecialization: string;
      primaryResumeVariant: string;
      headlines: Array<{ platform: string; headline: string }>;
      keywords: Array<{ platform: string; keywords: string[] }>;
      marketPositioning?: Record<string, unknown>;
    }>;
  };
  timeline: Array<{
    event_type: string;
    entity_type: string;
    entity_id: string;
    actor?: string;
    payload?: Record<string, unknown>;
    created_at: string;
  }>;
};

async function callGovernance(action: string, body: Record<string, unknown> = {}) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("governance_token") || "" : "";
  const response = await fetch("/api/governance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ action, ...body }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(String(errorBody?.error || "Governance action failed"));
  }

  return response.json();
}

export default function GovernancePage() {
  const [data, setData] = useState<GovernancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [busyAction, setBusyAction] = useState<string>("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/governance", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load governance state");
    }
    const payload = await response.json() as GovernancePayload;
    setData(payload);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const runAction = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    setBusyAction(action);
    setError("");
    try {
      await callGovernance(action, body);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyAction("");
    }
  }, [refresh]);

  const decisionRows = useMemo(() => {
    return (data?.timeline || []).filter((row) => {
      const payload = row.payload || {};
      return payload.kind === "decision_memory" || payload.kind === "governance_action" || payload.kind === "governance_state";
    }).slice(0, 80);
  }, [data]);

  const activeIdentity = data?.telemetry?.primaryActiveIdentity;

  if (loading) {
    return <main className="p-8">Loading governance console...</main>;
  }

  const state = data?.state;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-2xl bg-slate-900 text-slate-100 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Governance Console</p>
          <h1 className="mt-2 text-3xl font-black">Human Override Surface</h1>
          <p className="mt-2 text-sm text-slate-300">Rollback optimization, freeze adaptive modules, force pricing reset, pause orchestrator, and inspect decision history.</p>
        </section>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Tile label="Orchestrator" value={state?.orchestratorPaused ? "Paused" : "Running"} />
          <Tile label="Pricing reset" value={state?.forcedPricingReset ? "Forced" : "Normal"} />
          <Tile label="Frozen modules" value={Object.values(state?.frozenModules || {}).filter(Boolean).length.toString()} />
          <Tile label="Last update" value={state?.updatedAt ? new Date(state.updatedAt).toLocaleString() : "Unknown"} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Primary active identity"
            value={activeIdentity?.label || "Unknown"}
            subvalue={activeIdentity ? `${activeIdentity.confidence.toFixed(1)}% confidence · ${activeIdentity.stability.toFixed(1)}% stability` : "No active profile data"}
          />
          <MetricCard
            label="Primary specialization"
            value={activeIdentity?.specialization || "Unknown"}
            subvalue={activeIdentity?.userId ? `User ${activeIdentity.userId}` : "No owner detected"}
          />
          <MetricCard
            label="Resume realism"
            value={data?.telemetry?.realismTrend?.[0] ? `${Math.round(data.telemetry.realismTrend[0].resumeRealism)}%` : "Unknown"}
            subvalue="Tracks readability, naturalness, credibility, and over-optimization risk"
          />
          <MetricCard
            label="Honesty interventions"
            value={String(data?.telemetry?.honestyInterventions?.length || 0)}
            subvalue="Truth-preserving corrections and realism guardrails"
          />
          <MetricCard
            label="Identity cohesion"
            value={data?.telemetry?.cohesionTrend?.[0] ? `${Math.round(data.telemetry.cohesionTrend[0].identityCohesion)}%` : "Unknown"}
            subvalue={data?.telemetry?.cohesionTrend?.[0] ? `${Math.round(data.telemetry.cohesionTrend[0].divergenceRisk)}% divergence risk` : "Tracks continuity across variants"}
          />
          <MetricCard
            label="Interview alignment"
            value={data?.telemetry?.interviewAlignmentTrend?.[0] ? `${Math.round(data.telemetry.interviewAlignmentTrend[0].alignmentScore)}%` : "Unknown"}
            subvalue={data?.telemetry?.interviewAlignmentTrend?.[0] ? `${data.telemetry.interviewAlignmentTrend[0].meetingStage} stage · ${data.telemetry.interviewAlignmentTrend[0].intent}` : "Resume identity to interview guidance sync"}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Resume Variant Leaderboard">
            <div className="space-y-3">
              {(data?.telemetry?.resumeVariantLeaderboard || []).length === 0 ? (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No resume variant outcomes recorded yet.</p>
              ) : data!.telemetry!.resumeVariantLeaderboard.map((row) => (
                <div key={row.variant} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{row.variant}</p>
                    <p className="text-sm font-bold text-slate-900">{row.averageScore.toFixed(1)}</p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-slate-600">
                    <p>Callback rate: {(row.callbackRate * 100).toFixed(1)}%</p>
                    <p>Interview rate: {(row.interviewRate * 100).toFixed(1)}%</p>
                    <p>Conversion rate: {(row.conversionRate * 100).toFixed(1)}%</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Support: {row.support} profiles</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Realism Trend">
            <div className="space-y-3 max-h-[24rem] overflow-auto pr-1">
              {(data?.telemetry?.realismTrend || []).length === 0 ? (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No realism samples yet.</p>
              ) : data!.telemetry!.realismTrend.map((row) => (
                <div key={`${row.userId}-${row.updatedAt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{row.userId}</p>
                    <p className="text-xs text-slate-500">{new Date(row.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
                    <p>Realism: {Math.round(row.resumeRealism)}%</p>
                    <p>Profile confidence: {Math.round(row.profileConfidenceScore)}%</p>
                    <p>Deployment throttle: {Math.round(row.resumeDeploymentThrottle * 100)}%</p>
                    <p>Identity stability: {Math.round(row.identityStability)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Identity Cohesion Trend">
            <div className="space-y-3 max-h-[24rem] overflow-auto pr-1">
              {(data?.telemetry?.cohesionTrend || []).length === 0 ? (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No cohesion samples yet.</p>
              ) : data!.telemetry!.cohesionTrend.map((row) => (
                <div key={`${row.userId}-${row.updatedAt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{row.userId}</p>
                    <p className="text-xs text-slate-500">{new Date(row.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
                    <p>Cohesion: {Math.round(row.identityCohesion)}%</p>
                    <p>Divergence risk: {Math.round(row.divergenceRisk)}%</p>
                    <p>Consistency: {Math.round(row.consistency)}%</p>
                    <p>Believability: {Math.round(row.believability)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Resume / Identity Continuity Signals">
            <div className="space-y-2 max-h-[24rem] overflow-auto pr-1 text-sm">
              {data?.telemetry?.positioningMemoryViewer?.length ? (
                data.telemetry.positioningMemoryViewer.slice(0, 5).map((row) => (
                  <div key={row.userId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">{row.primaryIdentity}</p>
                    <p className="text-xs text-slate-500">{row.primarySpecialization} · {row.primaryResumeVariant}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No continuity signals available yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Interview Identity Alignment Trend">
            <div className="space-y-3 max-h-[24rem] overflow-auto pr-1">
              {(data?.telemetry?.interviewAlignmentTrend || []).length === 0 ? (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No interview alignment samples yet.</p>
              ) : data!.telemetry!.interviewAlignmentTrend.map((row) => (
                <div key={`${row.userId}-${row.updatedAt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{row.userId}</p>
                    <p className="text-xs text-slate-500">{new Date(row.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
                    <p>Alignment score: {Math.round(row.alignmentScore)}%</p>
                    <p>Stage: {row.meetingStage}</p>
                    <p>Intent: {row.intent}</p>
                    <p>Terminology terms: {row.terminology.length}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Top terms: {row.terminology.slice(0, 6).join(", ") || "n/a"}</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {row.workflowHints.slice(0, 3).map((hint, index) => (
                      <li key={`${row.userId}-${index}`}>- {hint}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Honesty-Layer Interventions">
            <div className="space-y-2 max-h-[24rem] overflow-auto pr-1">
              {(data?.telemetry?.honestyInterventions || []).length === 0 ? (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No honesty interventions recorded yet.</p>
              ) : data!.telemetry!.honestyInterventions.map((row, index) => (
                <div key={`${row.userId}-${row.updatedAt}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{row.type}</p>
                    <p className="text-xs text-slate-500">{new Date(row.updatedAt).toLocaleString()}</p>
                  </div>
                  <p className="mt-1 text-slate-600">{row.message}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Positioning Memory Viewer">
            <div className="space-y-3 max-h-[24rem] overflow-auto pr-1">
              {(data?.telemetry?.positioningMemoryViewer || []).length === 0 ? (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No positioning memory available yet.</p>
              ) : data!.telemetry!.positioningMemoryViewer.map((row) => (
                <details key={row.userId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{row.primaryIdentity}</p>
                      <p className="text-xs text-slate-500">{row.userId}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{row.primarySpecialization} · {row.primaryResumeVariant}</p>
                  </summary>
                  <div className="mt-3 space-y-3 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold text-slate-700">Headlines that worked</p>
                      <ul className="mt-1 space-y-1">
                        {row.headlines.slice(0, 4).map((headline) => (
                          <li key={`${row.userId}-${headline.platform}-${headline.headline}`}>{headline.platform}: {headline.headline}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">ATS keyword clusters</p>
                      <ul className="mt-1 space-y-1">
                        {row.keywords.slice(0, 4).map((item) => (
                          <li key={`${row.userId}-${item.platform}`}>{item.platform}: {item.keywords.slice(0, 8).join(", ")}</li>
                        ))}
                      </ul>
                    </div>
                    <pre className="overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-500">{JSON.stringify(row.marketPositioning || {}, null, 2)}</pre>
                  </div>
                </details>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Critical Controls">
            <div className="flex flex-wrap gap-2">
              <ActionButton busy={busyAction === "pause_orchestrator"} onClick={() => void runAction("pause_orchestrator")}>Pause orchestrator</ActionButton>
              <ActionButton busy={busyAction === "resume_orchestrator"} onClick={() => void runAction("resume_orchestrator")}>Resume orchestrator</ActionButton>
              <ActionButton busy={busyAction === "force_pricing_reset"} onClick={() => void runAction("force_pricing_reset")}>Force pricing reset</ActionButton>
              <ActionButton busy={busyAction === "clear_pricing_reset"} onClick={() => void runAction("clear_pricing_reset")}>Clear pricing reset</ActionButton>
              <ActionButton busy={busyAction === "rollback_pricing"} onClick={() => void runAction("rollback_optimization", { module: "pricing" })}>Rollback pricing</ActionButton>
              <ActionButton busy={busyAction === "rollback_platform"} onClick={() => void runAction("rollback_optimization", { module: "platform" })}>Rollback platform</ActionButton>
            </div>
          </Panel>

          <Panel title="Adaptive Module Freezes">
            <div className="grid gap-2 sm:grid-cols-2">
              {(["pricing", "platform", "workload", "reinforcement"] as const).map((module) => {
                const frozen = Boolean(state?.frozenModules?.[module]);
                return (
                  <div key={module} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold capitalize">{module}</p>
                    <p className="text-xs text-slate-500 mb-2">Status: {frozen ? "Frozen" : "Active"}</p>
                    <ActionButton
                      busy={busyAction === `${frozen ? "unfreeze" : "freeze"}_${module}`}
                      onClick={() => void runAction(frozen ? "unfreeze_module" : "freeze_module", { module })}
                    >
                      {frozen ? "Unfreeze" : "Freeze"}
                    </ActionButton>
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Decision Audit Timeline</h2>
          <p className="text-sm text-slate-500">Why optimization happened, confidence level, prior/new values, and rollback history.</p>
          <div className="mt-4 space-y-2 max-h-[32rem] overflow-auto pr-1">
            {decisionRows.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">No decision memory entries yet.</p>
            ) : decisionRows.map((row, idx) => {
              const payload = row.payload || {};
              const reason = String(payload.reason || payload.action || "n/a");
              const confidence = payload.confidence ?? "n/a";
              const previousValue = payload.previousValue ?? payload.previous ?? null;
              const nextValue = payload.nextValue ?? payload.next ?? payload.weights ?? null;

              return (
                <div key={`${row.created_at}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{String(payload.domain || payload.kind || row.entity_id || "event")}</p>
                    <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-slate-600">Reason: {reason}</p>
                  <p className="text-slate-600">Confidence: {String(confidence)}</p>
                  <p className="text-slate-600">Actor: {row.actor || "system"}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">View value changes</summary>
                    <pre className="mt-2 text-xs bg-white border border-slate-200 rounded p-2 overflow-auto">{JSON.stringify({ previousValue, nextValue }, null, 2)}</pre>
                  </details>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">{props.title}</h2>
      <div className="mt-3">{props.children}</div>
    </section>
  );
}

function Tile(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{props.value}</p>
    </div>
  );
}

function MetricCard(props: { label: string; value: string; subvalue: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{props.value}</p>
      <p className="mt-2 text-sm text-slate-600">{props.subvalue}</p>
    </div>
  );
}

function ActionButton(props: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.busy}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
    >
      {props.busy ? "Working..." : props.children}
    </button>
  );
}
