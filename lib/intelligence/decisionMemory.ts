import { writeAuditLog } from "@/lib/audit/auditLog";
import { supabaseServer } from "@/lib/supabaseServer";

export type DecisionDomain = "pricing" | "platform" | "workload" | "reinforcement" | "scoring";

export interface DecisionGuardrailPolicy {
  minConfidence: number;
  minSamples: number;
  cooldownMinutes: number;
  maxAdjustmentPct: number;
}

export interface DecisionMemoryRecord<TValue = unknown> {
  domain: DecisionDomain;
  decisionKey: string;
  status: "applied" | "blocked" | "rolled_back";
  reason: string;
  confidence: number;
  sampleSize: number;
  adjustmentPct: number;
  previousValue: TValue | null;
  nextValue: TValue | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface DecisionGuardrailInput<TValue = unknown> {
  domain: DecisionDomain;
  decisionKey: string;
  confidence: number;
  sampleSize: number;
  adjustmentPct: number;
  nextValue: TValue;
  policy: DecisionGuardrailPolicy;
  metadata?: Record<string, unknown>;
}

export interface DecisionGuardrailResult<TValue = unknown> {
  allowed: boolean;
  reason: string;
  previousValue: TValue | null;
}

const MEMORY_ENTITY_TYPE = "system";
const MEMORY_ENTITY_ID = "decision_memory";

function clampPct(value: number): number {
  return Number(Math.max(0, Math.min(100, Math.abs(value))).toFixed(2));
}

function toRecord(row: {
  payload?: Record<string, unknown> | null;
  created_at?: string;
}): DecisionMemoryRecord {
  const payload = row.payload ?? {};
  return {
    domain: String(payload.domain || "scoring") as DecisionDomain,
    decisionKey: String(payload.decisionKey || "global"),
    status: String(payload.status || "blocked") as DecisionMemoryRecord["status"],
    reason: String(payload.reason || "unknown"),
    confidence: Number(payload.confidence || 0),
    sampleSize: Number(payload.sampleSize || 0),
    adjustmentPct: Number(payload.adjustmentPct || 0),
    previousValue: (payload.previousValue as unknown) ?? null,
    nextValue: (payload.nextValue as unknown) ?? null,
    metadata: (payload.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  };
}

export async function getLatestDecision<TValue = unknown>(
  domain: DecisionDomain,
  decisionKey: string
): Promise<DecisionMemoryRecord<TValue> | null> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("payload, created_at")
    .eq("event_type", "agent_action")
    .eq("entity_type", MEMORY_ENTITY_TYPE)
    .eq("entity_id", MEMORY_ENTITY_ID)
    .order("created_at", { ascending: false })
    .limit(120);

  const rows = (data ?? []) as Array<{ payload?: Record<string, unknown> | null; created_at?: string }>;
  const match = rows.find((row) => {
    const payload = row.payload ?? {};
    return payload.kind === "decision_memory" && payload.domain === domain && payload.decisionKey === decisionKey;
  });

  if (!match) return null;
  return toRecord(match) as DecisionMemoryRecord<TValue>;
}

export async function recordDecision<TValue = unknown>(record: DecisionMemoryRecord<TValue>): Promise<void> {
  await writeAuditLog({
    event_type: "agent_action",
    entity_type: MEMORY_ENTITY_TYPE,
    entity_id: MEMORY_ENTITY_ID,
    actor: "system",
    payload: {
      kind: "decision_memory",
      domain: record.domain,
      decisionKey: record.decisionKey,
      status: record.status,
      reason: record.reason,
      confidence: Number(record.confidence.toFixed(3)),
      sampleSize: record.sampleSize,
      adjustmentPct: clampPct(record.adjustmentPct),
      previousValue: record.previousValue,
      nextValue: record.nextValue,
      metadata: record.metadata ?? {},
    },
  });
}

export async function evaluateDecisionGuardrail<TValue = unknown>(
  input: DecisionGuardrailInput<TValue>
): Promise<DecisionGuardrailResult<TValue>> {
  const previous = await getLatestDecision<TValue>(input.domain, input.decisionKey);

  if (input.confidence < input.policy.minConfidence) {
    return {
      allowed: false,
      reason: `confidence ${input.confidence.toFixed(2)} below threshold ${input.policy.minConfidence.toFixed(2)}`,
      previousValue: previous?.nextValue ?? null,
    };
  }

  if (input.sampleSize < input.policy.minSamples) {
    return {
      allowed: false,
      reason: `sample size ${input.sampleSize} below minimum ${input.policy.minSamples}`,
      previousValue: previous?.nextValue ?? null,
    };
  }

  if (Math.abs(input.adjustmentPct) > input.policy.maxAdjustmentPct) {
    return {
      allowed: false,
      reason: `adjustment ${Math.abs(input.adjustmentPct).toFixed(2)}% above max ${input.policy.maxAdjustmentPct.toFixed(2)}%`,
      previousValue: previous?.nextValue ?? null,
    };
  }

  const lastAppliedAt = previous?.createdAt ? new Date(previous.createdAt).getTime() : 0;
  if (lastAppliedAt > 0) {
    const cooldownMs = input.policy.cooldownMinutes * 60_000;
    const elapsed = Date.now() - lastAppliedAt;
    if (elapsed < cooldownMs) {
      const remainingMins = Math.ceil((cooldownMs - elapsed) / 60_000);
      return {
        allowed: false,
        reason: `cooldown active (${remainingMins}m remaining)`,
        previousValue: previous?.nextValue ?? null,
      };
    }
  }

  return {
    allowed: true,
    reason: "guardrails passed",
    previousValue: previous?.nextValue ?? null,
  };
}

export async function rollbackDecision<TValue = unknown>(
  domain: DecisionDomain,
  decisionKey: string,
  reason = "manual rollback"
): Promise<TValue | null> {
  const latest = await getLatestDecision<TValue>(domain, decisionKey);
  if (!latest?.nextValue) return null;

  await recordDecision<TValue>({
    domain,
    decisionKey,
    status: "rolled_back",
    reason,
    confidence: latest.confidence,
    sampleSize: latest.sampleSize,
    adjustmentPct: latest.adjustmentPct,
    previousValue: latest.nextValue,
    nextValue: latest.previousValue,
    metadata: { rollbackOf: latest.createdAt },
  });

  return (latest.previousValue as TValue | null) ?? null;
}
