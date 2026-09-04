"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdaptiveGrid } from "@/components/adaptive/AdaptiveWorkspaces";
import { computeEffectiveSessionShape } from "@/lib/ui/adaptiveSessionEngine";
import { generateContinuitySafeguard, generateRecoveryReflections } from "@/lib/ui/recoveryIntelligence";

interface PortalData {
  contracts: Array<{
    id: string;
    deal_id: string;
    status: string;
    signed_at?: string;
    created_at: string;
  }>;
  invoices: Array<{
    id: string;
    amount: number;
    status: string;
    due_date: string;
    payment_link?: string;
    paid_at?: string;
  }>;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function derivePortalPressureState({
  contracts,
  invoices,
}: {
  contracts: PortalData["contracts"];
  invoices: PortalData["invoices"];
}): "balanced" | "stabilizing" | "recovery" | "accelerated" | "locked" {
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue").length;
  const signedContracts = contracts.filter((contract) => contract.status === "signed").length;
  const signedRate = contracts.length > 0 ? signedContracts / contracts.length : 0;
  const overdueRate = invoices.length > 0 ? overdueInvoices / invoices.length : 0;

  if (overdueRate > 0.35) return "recovery";
  if (overdueRate > 0.15) return "stabilizing";
  if (signedRate > 0.8 && invoices.length > 0) return "accelerated";
  if (contracts.length === 0 && invoices.length === 0) return "locked";

  return "balanced";
}

export default function ClientPortal() {
  const lastTelemetrySignatureRef = useRef("");
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"contracts" | "invoices">(
    "contracts"
  );

  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        const response = await fetch("/api/portal");
        if (!response.ok) throw new Error("Failed to fetch portal data");

        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPortalData();
  }, []);

  const contracts = useMemo(() => data?.contracts || [], [data]);
  const invoices = useMemo(() => data?.invoices || [], [data]);

  const portalSessionShape = useMemo(() => {
    const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue").length;
    const signedContracts = contracts.filter((contract) => contract.status === "signed").length;
    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid").length;
    const pendingInvoices = invoices.filter((invoice) => invoice.status !== "paid").length;
    const pressureState = derivePortalPressureState({ contracts, invoices });
    const fatigueRisk = clamp01(
      (overdueInvoices / Math.max(1, invoices.length)) * 0.65 +
        (pendingInvoices > 0 ? 0.18 : 0) +
        (contracts.length === 0 ? 0.1 : 0) -
        (signedContracts / Math.max(1, contracts.length)) * 0.15 -
        (paidInvoices / Math.max(1, invoices.length || 1)) * 0.1
    );

    return computeEffectiveSessionShape(pressureState, fatigueRisk);
  }, [contracts, invoices]);

  const recoveryInsights = useMemo(() => {
    const recentCompletions = contracts.filter((contract) => contract.status === "signed").map((contract) => `contract:${contract.id}`);
    const fatigueRisk = clamp01(invoices.filter((invoice) => invoice.status !== "paid").length / Math.max(1, invoices.length));

    const reflections = generateRecoveryReflections({
      recentCompletions,
      recentAbandoned: invoices.filter((invoice) => invoice.status === "overdue").map((invoice) => `invoice:${invoice.id}`),
      pressureState: derivePortalPressureState({ contracts, invoices }),
      fatigueRisk,
      trustScore: clamp01(recentCompletions.length / Math.max(1, contracts.length || 1)),
      identityStable: recentCompletions.length > 0,
    });

    const safeguard = generateContinuitySafeguard({
      stablePatterns: ["Follow up on sent contracts", "Resolve oldest invoices first"],
      successfulWorkflows: recentCompletions,
      trustDirection: "Steady contract closure and predictable billing",
      identityCore: "Reliable client delivery",
    });

    return { reflections, safeguard, fatigueRisk };
  }, [contracts, invoices]);

  useEffect(() => {
    const pressureState = derivePortalPressureState({ contracts, invoices });
    const signature = `${pressureState}|${portalSessionShape.workspaceMode}|${recoveryInsights.fatigueRisk.toFixed(3)}`;
    const previousSignature = lastTelemetrySignatureRef.current;
    if (signature === lastTelemetrySignatureRef.current) {
      return;
    }

    lastTelemetrySignatureRef.current = signature;
    const previousState = previousSignature.split("|")[0] || pressureState;

    const post = async (eventType: string, nextState: string) => {
      try {
        await fetch("/api/telemetry/equilibrium-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: {
              userId: "portal-session",
              eventType,
              previousState,
              nextState,
              pressureLevel: clamp01(recoveryInsights.fatigueRisk + (pressureState === "recovery" ? 0.25 : 0)),
              fatigueRisk: recoveryInsights.fatigueRisk,
              recoveryTriggered: pressureState === "recovery" || portalSessionShape.workspaceMode === "recovery",
              metadata: {
                contracts: contracts.length,
                invoices: invoices.length,
              },
            },
          }),
        });
      } catch (error) {
        console.error("portal telemetry emit failed", error);
      }
    };

    void post("equilibrium_transition", pressureState);
    if (portalSessionShape.workspaceMode === "recovery" || portalSessionShape.workspaceMode === "focused") {
      void post("workspace_contraction", portalSessionShape.workspaceMode);
    }
  }, [contracts, invoices, portalSessionShape.workspaceMode, recoveryInsights.fatigueRisk]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading your portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">
          <p className="text-lg font-semibold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800",
    sent: "bg-blue-100 text-blue-800",
    signed: "bg-green-100 text-green-800",
    pending: "bg-orange-100 text-orange-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.95),_rgba(2,6,23,1))] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.4em] text-sky-300/80">Adaptive Portal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50">
            Client Portal
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            The portal now compresses or expands its density based on signing pressure and invoice load so the surface stays calm when completion is behind.
          </p>
        </div>

        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-950/50 p-4 shadow-xl shadow-black/20">
          <AdaptiveGrid shape={portalSessionShape}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Portal mode</p>
              <p className="mt-2 text-xl font-semibold capitalize text-slate-50">{portalSessionShape.workspaceMode}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Contracts</p>
              <p className="mt-2 text-xl font-semibold text-slate-50">{contracts.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Invoices</p>
              <p className="mt-2 text-xl font-semibold text-slate-50">{invoices.length}</p>
            </div>
          </AdaptiveGrid>
        </div>

        <div className="mb-8 rounded-3xl border border-emerald-800/40 bg-gradient-to-r from-emerald-950/20 via-slate-950 to-cyan-950/20 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Continuity Recovery Signals</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">{recoveryInsights.safeguard}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-xl bg-slate-900/70 p-3 text-slate-200">You’ve maintained strong consistency.</div>
            <div className="rounded-xl bg-slate-900/70 p-3 text-slate-200">Progress remains steady.</div>
            <div className="rounded-xl bg-slate-900/70 p-3 text-slate-200">Your direction is becoming clearer.</div>
          </div>
          {recoveryInsights.reflections.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {recoveryInsights.reflections.map((reflection) => (
                <li key={reflection.title} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <span className="font-medium text-slate-100">{reflection.title}:</span> {reflection.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("contracts")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "contracts"
                ? "border-b-2 border-sky-400 text-sky-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Contracts ({contracts.length})
          </button>

          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "invoices"
                ? "border-b-2 border-sky-400 text-sky-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Invoices ({invoices.length})
          </button>
        </div>

        {/* Contracts Tab */}
        {activeTab === "contracts" && (
          <div className={portalSessionShape.workspaceMode === "recovery" ? "space-y-4 max-w-3xl" : "space-y-4"}>
            {contracts.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center">
                <p className="text-slate-300">No contracts yet.</p>
              </div>
            ) : (
              contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-black/20 transition-shadow hover:border-slate-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-50">
                        Service Contract
                      </h3>
                      <p className="text-sm text-slate-400">
                        {new Date(contract.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        statusColors[contract.status] ||
                        "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {contract.status.toUpperCase()}
                    </span>
                  </div>

                  {contract.signed_at && (
                    <p className="mb-4 text-sm text-emerald-300">
                      ✓ Signed on{" "}
                      {new Date(contract.signed_at).toLocaleDateString()}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {contract.status === "sent" && (
                      <button className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 transition-colors hover:bg-sky-400">
                        Sign Contract
                      </button>
                    )}

                    <button className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-medium text-slate-100 transition-colors hover:bg-slate-800">
                      📥 Download
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div className={portalSessionShape.workspaceMode === "continuity" ? "space-y-4 max-w-2xl" : "space-y-4"}>
            {invoices.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center">
                <p className="text-slate-300">No invoices yet.</p>
              </div>
            ) : (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-black/20 transition-shadow hover:border-slate-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-50">
                        Invoice
                      </h3>
                      <p className="mt-1 text-2xl font-bold text-slate-50">
                        R
                        {invoice.amount.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        statusColors[invoice.status] ||
                        "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {invoice.status.toUpperCase()}
                    </span>
                  </div>

                  {invoice.paid_at && (
                    <p className="mb-4 text-sm text-emerald-300">
                      ✓ Paid on{" "}
                      {new Date(invoice.paid_at).toLocaleDateString()}
                    </p>
                  )}

                  {!invoice.paid_at && (
                    <p className="mb-4 text-sm text-slate-400">
                      Due:{" "}
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {invoice.status !== "paid" && invoice.payment_link && (
                      <a
                        href={invoice.payment_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 transition-colors hover:bg-emerald-400"
                      >
                        💳 Pay Now
                      </a>
                    )}

                    <button className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-medium text-slate-100 transition-colors hover:bg-slate-800">
                      📥 Download
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
