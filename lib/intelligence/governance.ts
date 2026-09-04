import { rollbackDecision } from "@/lib/intelligence/decisionMemory";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { supabaseServer } from "@/lib/supabaseServer";

export type AdaptiveModule = "pricing" | "platform" | "workload" | "reinforcement";

export interface GovernanceState {
  orchestratorPaused: boolean;
  frozenModules: Record<AdaptiveModule, boolean>;
  forcedPricingReset: boolean;
  workloadOverride: {
    enabled: boolean;
    assignments: Array<{ workItemId: string; assignedAgent: string; reason?: string }>;
  };
  updatedAt: string;
  updatedBy: string;
  reason: string;
}

const DEFAULT_STATE: GovernanceState = {
  orchestratorPaused: false,
  frozenModules: {
    pricing: false,
    platform: false,
    workload: false,
    reinforcement: false,
  },
  forcedPricingReset: false,
  workloadOverride: {
    enabled: false,
    assignments: [],
  },
  updatedAt: new Date(0).toISOString(),
  updatedBy: "system",
  reason: "initial default",
};

function parseGovernance(payload: Record<string, unknown> | null | undefined): GovernanceState | null {
  if (!payload || payload.kind !== "governance_state") return null;

  const frozen = (payload.frozenModules as Record<AdaptiveModule, boolean> | undefined) ?? DEFAULT_STATE.frozenModules;
  const workload = (payload.workloadOverride as GovernanceState["workloadOverride"] | undefined) ?? DEFAULT_STATE.workloadOverride;

  return {
    orchestratorPaused: Boolean(payload.orchestratorPaused),
    frozenModules: {
      pricing: Boolean(frozen.pricing),
      platform: Boolean(frozen.platform),
      workload: Boolean(frozen.workload),
      reinforcement: Boolean(frozen.reinforcement),
    },
    forcedPricingReset: Boolean(payload.forcedPricingReset),
    workloadOverride: {
      enabled: Boolean(workload.enabled),
      assignments: Array.isArray(workload.assignments) ? workload.assignments : [],
    },
    updatedAt: String(payload.updatedAt || new Date().toISOString()),
    updatedBy: String(payload.updatedBy || "system"),
    reason: String(payload.reason || "update"),
  };
}

export async function getGovernanceState(): Promise<GovernanceState> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("payload, created_at")
    .eq("event_type", "agent_action")
    .eq("entity_type", "system")
    .eq("entity_id", "governance_state")
    .order("created_at", { ascending: false })
    .limit(50);

  for (const row of (data ?? []) as Array<{ payload?: Record<string, unknown> | null }>) {
    const parsed = parseGovernance(row.payload);
    if (parsed) return parsed;
  }

  return { ...DEFAULT_STATE };
}

export async function setGovernanceState(patch: Partial<GovernanceState>, actor: string, reason: string): Promise<GovernanceState> {
  const current = await getGovernanceState();

  const merged: GovernanceState = {
    ...current,
    ...patch,
    frozenModules: {
      ...current.frozenModules,
      ...(patch.frozenModules ?? {}),
    },
    workloadOverride: {
      ...current.workloadOverride,
      ...(patch.workloadOverride ?? {}),
      assignments: patch.workloadOverride?.assignments ?? current.workloadOverride.assignments,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
    reason,
  };

  await writeAuditLog({
    event_type: "agent_action",
    entity_type: "system",
    entity_id: "governance_state",
    actor,
    payload: {
      kind: "governance_state",
      ...merged,
    },
  });

  return merged;
}

export async function isAdaptiveModuleFrozen(module: AdaptiveModule): Promise<boolean> {
  const state = await getGovernanceState();
  return Boolean(state.frozenModules[module]);
}

export async function isOrchestratorPausedGlobally(): Promise<boolean> {
  const state = await getGovernanceState();
  return state.orchestratorPaused;
}

export async function getWorkloadOverride(): Promise<GovernanceState["workloadOverride"]> {
  const state = await getGovernanceState();
  return state.workloadOverride;
}

export async function rollbackOptimization(domain: AdaptiveModule, reason: string, actor = "governance"): Promise<void> {
  await rollbackDecision(domain, "global", reason);
  await writeAuditLog({
    event_type: "agent_action",
    entity_type: "system",
    entity_id: "governance_action",
    actor,
    payload: {
      kind: "governance_action",
      action: "rollback_optimization",
      domain,
      reason,
    },
  });
}

export async function getDecisionAuditTimeline(limit = 120): Promise<Array<Record<string, unknown>>> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("event_type, entity_type, entity_id, actor, payload, created_at")
    .eq("event_type", "agent_action")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Array<Record<string, unknown>>;
}
