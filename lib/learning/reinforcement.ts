import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit/auditLog";

export type ReinforcementSignalType =
  | "proposal_won"
  | "proposal_lost"
  | "interview_success"
  | "interview_failed"
  | "payment_delayed"
  | "conversion_up"
  | "conversion_down";

export interface ReinforcementSignal {
  agentName: string;
  signal: ReinforcementSignalType;
  intensity?: number; // 0-1
  context?: Record<string, unknown>;
}

export interface AgentAdaptiveWeights {
  scoringWeight: number;
  proposalToneWeight: number;
  outreachTimingWeight: number;
  negotiationToneWeight: number;
}

export interface ReinforcementUpdate {
  agentName: string;
  previous: AgentAdaptiveWeights;
  updated: AgentAdaptiveWeights;
  delta: AgentAdaptiveWeights;
}

export interface ReinforcementCycleResult {
  cycleApplied: boolean;
  cooldownActive: boolean;
  confidence: number;
  signalsProcessed: number;
  updates: ReinforcementUpdate[];
  rollbackCount: number;
  proposalTypeWeights: Record<string, number>;
}

const DEFAULT_WEIGHTS: AgentAdaptiveWeights = {
  scoringWeight: 1,
  proposalToneWeight: 1,
  outreachTimingWeight: 1,
  negotiationToneWeight: 1,
};

function clampWeight(value: number): number {
  return Number(Math.max(0.4, Math.min(2.5, value)).toFixed(3));
}

function clampDelta(value: number, maxStep: number): number {
  return Number(Math.max(-maxStep, Math.min(maxStep, value)).toFixed(4));
}

function toDelta(signal: ReinforcementSignal): AgentAdaptiveWeights {
  const intensity = Math.max(0.1, Math.min(1.5, Number(signal.intensity || 1)));

  switch (signal.signal) {
    case "proposal_won":
      return {
        scoringWeight: 0.02 * intensity,
        proposalToneWeight: 0.05 * intensity,
        outreachTimingWeight: 0.01 * intensity,
        negotiationToneWeight: 0.02 * intensity,
      };
    case "proposal_lost":
      return {
        scoringWeight: -0.03 * intensity,
        proposalToneWeight: -0.05 * intensity,
        outreachTimingWeight: -0.02 * intensity,
        negotiationToneWeight: -0.01 * intensity,
      };
    case "interview_success":
      return {
        scoringWeight: 0.04 * intensity,
        proposalToneWeight: 0.01 * intensity,
        outreachTimingWeight: 0.02 * intensity,
        negotiationToneWeight: 0.03 * intensity,
      };
    case "interview_failed":
      return {
        scoringWeight: -0.04 * intensity,
        proposalToneWeight: -0.01 * intensity,
        outreachTimingWeight: -0.03 * intensity,
        negotiationToneWeight: -0.02 * intensity,
      };
    case "payment_delayed":
      return {
        scoringWeight: -0.02 * intensity,
        proposalToneWeight: 0,
        outreachTimingWeight: -0.05 * intensity,
        negotiationToneWeight: 0.04 * intensity,
      };
    case "conversion_up":
      return {
        scoringWeight: 0.03 * intensity,
        proposalToneWeight: 0.03 * intensity,
        outreachTimingWeight: 0.03 * intensity,
        negotiationToneWeight: 0.03 * intensity,
      };
    case "conversion_down":
      return {
        scoringWeight: -0.03 * intensity,
        proposalToneWeight: -0.03 * intensity,
        outreachTimingWeight: -0.03 * intensity,
        negotiationToneWeight: -0.03 * intensity,
      };
    default:
      return { ...DEFAULT_WEIGHTS };
  }
}

async function readLatestWeights(agentName: string): Promise<AgentAdaptiveWeights> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("payload, created_at")
    .eq("entity_type", "agent")
    .eq("entity_id", agentName)
    .eq("event_type", "agent_action")
    .order("created_at", { ascending: false })
    .limit(25);

  const entries = (data ?? []) as Array<{ payload?: Record<string, unknown> }>;
  const latest = entries.find((entry) => {
    const payload = entry.payload ?? {};
    return payload.kind === "reinforcement_weights";
  });

  if (!latest?.payload) return { ...DEFAULT_WEIGHTS };

  const weights = latest.payload.weights as Partial<AgentAdaptiveWeights> | undefined;
  return {
    scoringWeight: clampWeight(Number(weights?.scoringWeight ?? DEFAULT_WEIGHTS.scoringWeight)),
    proposalToneWeight: clampWeight(Number(weights?.proposalToneWeight ?? DEFAULT_WEIGHTS.proposalToneWeight)),
    outreachTimingWeight: clampWeight(Number(weights?.outreachTimingWeight ?? DEFAULT_WEIGHTS.outreachTimingWeight)),
    negotiationToneWeight: clampWeight(Number(weights?.negotiationToneWeight ?? DEFAULT_WEIGHTS.negotiationToneWeight)),
  };
}

export async function applyReinforcement(
  signal: ReinforcementSignal,
  options?: { maxWeightStep?: number }
): Promise<ReinforcementUpdate> {
  const maxWeightStep = Math.max(0.01, Math.min(0.3, Number(options?.maxWeightStep ?? 0.08)));
  const previous = await readLatestWeights(signal.agentName);
  const rawDelta = toDelta(signal);
  const delta: AgentAdaptiveWeights = {
    scoringWeight: clampDelta(rawDelta.scoringWeight, maxWeightStep),
    proposalToneWeight: clampDelta(rawDelta.proposalToneWeight, maxWeightStep),
    outreachTimingWeight: clampDelta(rawDelta.outreachTimingWeight, maxWeightStep),
    negotiationToneWeight: clampDelta(rawDelta.negotiationToneWeight, maxWeightStep),
  };

  const updated: AgentAdaptiveWeights = {
    scoringWeight: clampWeight(previous.scoringWeight + delta.scoringWeight),
    proposalToneWeight: clampWeight(previous.proposalToneWeight + delta.proposalToneWeight),
    outreachTimingWeight: clampWeight(previous.outreachTimingWeight + delta.outreachTimingWeight),
    negotiationToneWeight: clampWeight(previous.negotiationToneWeight + delta.negotiationToneWeight),
  };

  await writeAuditLog({
    event_type: "agent_action",
    entity_type: "agent",
    entity_id: signal.agentName,
    actor: "system",
    payload: {
      kind: "reinforcement_weights",
      signal: signal.signal,
      context: signal.context ?? {},
      previous,
      delta,
      weights: updated,
    },
  });

  return {
    agentName: signal.agentName,
    previous,
    updated,
    delta,
  };
}

export async function getAdaptiveWeights(agentName: string): Promise<AgentAdaptiveWeights> {
  return readLatestWeights(agentName);
}

export async function rollbackLatestAgentWeights(agentName: string, reason: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("payload, created_at")
    .eq("entity_type", "agent")
    .eq("entity_id", agentName)
    .eq("event_type", "agent_action")
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = (data ?? []) as Array<{ payload?: Record<string, unknown> }>;
  const latest = rows.find((row) => (row.payload ?? {}).kind === "reinforcement_weights");
  if (!latest?.payload) return false;

  const previous = latest.payload.previous as AgentAdaptiveWeights | undefined;
  const current = latest.payload.weights as AgentAdaptiveWeights | undefined;
  if (!previous || !current) return false;

  await writeAuditLog({
    event_type: "agent_action",
    entity_type: "agent",
    entity_id: agentName,
    actor: "system",
    payload: {
      kind: "reinforcement_weights",
      signal: "conversion_down",
      context: { rollback: true, reason },
      previous: current,
      delta: {
        scoringWeight: Number((previous.scoringWeight - current.scoringWeight).toFixed(4)),
        proposalToneWeight: Number((previous.proposalToneWeight - current.proposalToneWeight).toFixed(4)),
        outreachTimingWeight: Number((previous.outreachTimingWeight - current.outreachTimingWeight).toFixed(4)),
        negotiationToneWeight: Number((previous.negotiationToneWeight - current.negotiationToneWeight).toFixed(4)),
      },
      weights: previous,
    },
  });

  return true;
}

type AgentOutcomeRow = {
  agent_name: string;
  outcome: string | null;
  created_at: string;
};

async function getProposalTypeWeights(): Promise<Record<string, number>> {
  const [activityRes, dealsRes] = await Promise.all([
    supabaseServer
      .from("activities")
      .select("deal_id, metadata, note")
      .eq("type", "proposal")
      .order("created_at", { ascending: false })
      .limit(400),
    supabaseServer
      .from("deals")
      .select("id, stage")
      .in("stage", ["closed_won", "closed_lost"])
      .limit(500),
  ]);

  const stageByDeal = new Map<string, string>();
  for (const row of (dealsRes.data ?? []) as Array<{ id: string; stage: string }>) {
    stageByDeal.set(row.id, row.stage);
  }

  const grouped = new Map<string, { wins: number; total: number }>();
  for (const row of (activityRes.data ?? []) as Array<{ deal_id: string; metadata?: Record<string, unknown> | null; note?: string | null }>) {
    const proposalType = String(
      row.metadata?.proposal_type ?? row.metadata?.template ?? "default"
    ).toLowerCase();
    const stage = stageByDeal.get(row.deal_id);
    if (!stage) continue;

    const current = grouped.get(proposalType) ?? { wins: 0, total: 0 };
    current.total += 1;
    if (stage === "closed_won") current.wins += 1;
    grouped.set(proposalType, current);
  }

  const weights: Record<string, number> = {};
  for (const [proposalType, stats] of grouped.entries()) {
    if (stats.total < 3) continue;
    const closeRate = stats.wins / stats.total;
    const targetWeight = closeRate >= 0.3 ? 1.2 : closeRate <= 0.15 ? 0.85 : 1;
    weights[proposalType] = Number(targetWeight.toFixed(2));
  }

  return weights;
}

async function recentReinforcementRunAgeHours(): Promise<number> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("created_at")
    .eq("event_type", "agent_action")
    .eq("entity_type", "system")
    .eq("entity_id", "reinforcement_cycle")
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = (data?.[0] as { created_at?: string } | undefined)?.created_at;
  if (!latest) return Number.POSITIVE_INFINITY;

  const elapsedMs = Date.now() - new Date(latest).getTime();
  return elapsedMs / 3_600_000;
}

export async function runReinforcementCycle(options?: {
  cooldownHours?: number;
  minConfidence?: number;
  maxSignals?: number;
  maxWeightStep?: number;
  rollbackOnLowConfidence?: boolean;
}): Promise<ReinforcementCycleResult> {
  const cooldownHours = Math.max(0.25, Number(options?.cooldownHours ?? 2));
  const minConfidence = Math.max(0.2, Math.min(1, Number(options?.minConfidence ?? 0.45)));
  const maxSignals = Math.max(1, Number(options?.maxSignals ?? 12));
  const maxWeightStep = Math.max(0.01, Math.min(0.3, Number(options?.maxWeightStep ?? 0.08)));
  const rollbackOnLowConfidence = options?.rollbackOnLowConfidence !== false;

  const ageHours = await recentReinforcementRunAgeHours();
  const cooldownActive = ageHours < cooldownHours;

  const { data } = await supabaseServer
    .from("agent_activities")
    .select("agent_name, outcome, created_at")
    .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(500);

  const rows = (data ?? []) as AgentOutcomeRow[];
  const grouped = new Map<string, { successes: number; failures: number; total: number }>();

  for (const row of rows) {
    const key = row.agent_name;
    const current = grouped.get(key) ?? { successes: 0, failures: 0, total: 0 };
    current.total += 1;
    if (String(row.outcome || "").toLowerCase() === "failure") current.failures += 1;
    else current.successes += 1;
    grouped.set(key, current);
  }

  const confidence = rows.length >= 50 ? 0.8 : rows.length >= 20 ? 0.6 : 0.35;
  const updates: ReinforcementUpdate[] = [];
  let rollbackCount = 0;
  const proposalTypeWeights = await getProposalTypeWeights();

  if (!cooldownActive && confidence >= minConfidence) {
    const signals: ReinforcementSignal[] = [];

    for (const [agentName, stats] of grouped.entries()) {
      if (stats.total < 5) continue;
      const successRate = stats.successes / stats.total;
      signals.push({
        agentName,
        signal: successRate >= 0.55 ? "conversion_up" : "conversion_down",
        intensity: Math.abs(successRate - 0.5) * 2,
        context: { successRate, total: stats.total },
      });
    }

    const { data: overdue } = await supabaseServer
      .from("invoices")
      .select("id")
      .eq("status", "overdue")
      .limit(200);

    if ((overdue?.length ?? 0) > 0) {
      signals.push({
        agentName: "BillingAgent",
        signal: "payment_delayed",
        intensity: Math.min(1.5, (overdue?.length ?? 0) / 10),
        context: { overdueInvoices: overdue?.length ?? 0 },
      });
    }

    const boundedSignals = signals.slice(0, maxSignals);
    for (const signal of boundedSignals) {
      updates.push(await applyReinforcement(signal, { maxWeightStep }));
    }

    await writeAuditLog({
      event_type: "agent_action",
      entity_type: "system",
      entity_id: "reinforcement_cycle",
      actor: "system",
      payload: {
        kind: "reinforcement_cycle",
        confidence,
        signalsProcessed: boundedSignals.length,
        proposalTypeWeights,
      },
    });
  } else if (!cooldownActive && confidence < minConfidence && rollbackOnLowConfidence) {
    for (const [agentName, stats] of grouped.entries()) {
      if (stats.total < 5) continue;
      const successRate = stats.successes / stats.total;
      if (successRate < 0.35) {
        const rolledBack = await rollbackLatestAgentWeights(
          agentName,
          `low confidence cycle (${confidence.toFixed(2)}) and low success rate (${successRate.toFixed(2)})`
        );
        if (rolledBack) rollbackCount += 1;
      }
    }

    if (rollbackCount > 0) {
      await writeAuditLog({
        event_type: "agent_action",
        entity_type: "system",
        entity_id: "reinforcement_cycle",
        actor: "system",
        payload: {
          kind: "reinforcement_rollback",
          confidence,
          rollbackCount,
        },
      });
    }
  }

  return {
    cycleApplied: !cooldownActive && confidence >= minConfidence,
    cooldownActive,
    confidence: Number(confidence.toFixed(2)),
    signalsProcessed: updates.length,
    updates,
    rollbackCount,
    proposalTypeWeights,
  };
}
