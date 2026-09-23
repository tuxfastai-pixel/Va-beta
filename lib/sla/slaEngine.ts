/**
 * Scope Creep Protection + SLA Enforcement Engine
 * Uses the `sla_records` table (created in 20260508_rls_and_audit.sql).
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { logger } from "@/lib/logger/logger";

export type SLAStatus = "pending" | "delivered" | "overdue" | "disputed";

export interface Milestone {
  id:            string;
  dealId:        string;
  milestone:     string;
  dueDate:       string;
  deliveredAt?:  string;
  status:        SLAStatus;
}

export interface ScopeAlert {
  dealId:       string;
  description:  string;
  severity:     "low" | "medium" | "high";
  activities:   string[];
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Milestone management
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Define a deliverable milestone for a deal */
export async function createMilestone(
  dealId:    string,
  milestone: string,
  dueDate:   Date
): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("sla_records")
    .insert({
      deal_id:   dealId,
      milestone,
      due_date:  dueDate.toISOString(),
      status:    "pending",
    })
    .select("id")
    .single();

  if (error) {
    logger.error(
      "[SLA] Failed to create milestone",
      { dealId, milestone, error },
      { operation: "createMilestone" },
    );
    return null;
  }

  await writeAuditLog({
    event_type:  "sla_missed",  // Re-using closest event type; swap when schema gains sla_created
    entity_type: "deal",
    entity_id:   dealId,
    actor:    "system",
    payload:    { action: "milestone_created", milestone, dueDate: dueDate.toISOString() },
  });

  logger.info(`[SLA] Milestone created: ${milestone} for deal ${dealId}`, {}, "createMilestone");
  return data?.id ?? null;
}

/** Mark a milestone as delivered */
export async function deliverMilestone(slaRecordId: string): Promise<void> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("sla_records")
    .update({ status: "delivered", delivered_at: now })
    .eq("id", slaRecordId)
    .select("deal_id, milestone")
    .single();

  if (error) {
    logger.error(
      "[SLA] Failed to deliver milestone",
      { slaRecordId, error },
      { operation: "deliverMilestone" },
    );
    return;
  }

  await writeAuditLog({
    event_type:  "sla_missed",  // closest available; payload distinguishes
    entity_type: "deal",
    entity_id:   data?.deal_id ?? slaRecordId,
    actor:    "system",
    payload:    { action: "milestone_delivered", milestone: data?.milestone, deliveredAt: now },
  });

  logger.info(`[SLA] Milestone delivered: ${data?.milestone}`, {}, "deliverMilestone");
}

/** Mark a milestone as disputed */
export async function disputeMilestone(slaRecordId: string, reason: string): Promise<void> {
  await supabaseServer
    .from("sla_records")
    .update({ status: "disputed" })
    .eq("id", slaRecordId);

  logger.warn(`[SLA] Milestone disputed: ${slaRecordId} â€” ${reason}`, {}, "disputeMilestone");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Overdue detection (called daily by orchestrator)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Scan for pending milestones past their due date and mark as overdue */
export async function checkOverdueSLAs(): Promise<Milestone[]> {
  const now = new Date().toISOString();

  // Mark overdue first
  await supabaseServer
    .from("sla_records")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .lt("due_date", now);

  // Fetch all overdue records
  const { data } = await supabaseServer
    .from("sla_records")
    .select("*")
    .eq("status", "overdue");

  const overdue: Milestone[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id:           r.id as string,
    dealId:       r.deal_id as string,
    milestone:    r.milestone as string,
    dueDate:      r.due_date as string,
    deliveredAt:  r.delivered_at as string | undefined,
    status:       "overdue",
  }));

  if (overdue.length > 0) {
    logger.warn(`[SLA] ${overdue.length} overdue milestones detected`, {}, "checkOverdueSLAs");

    // Batch audit
    await Promise.all(
      overdue.map((m) =>
        writeAuditLog({
          event_type:  "sla_missed",
          entity_type: "deal",
          entity_id:   m.dealId,
          actor:    "system",
          payload:    { milestone: m.milestone, dueDate: m.dueDate },
        })
      )
    );
  }

  return overdue;
}

/** Get all milestones for a deal */
export async function getDealMilestones(dealId: string): Promise<Milestone[]> {
  const { data } = await supabaseServer
    .from("sla_records")
    .select("*")
    .eq("deal_id", dealId)
    .order("due_date", { ascending: true });

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id:          r.id as string,
    dealId:      r.deal_id as string,
    milestone:   r.milestone as string,
    dueDate:     r.due_date as string,
    deliveredAt: r.delivered_at as string | undefined,
    status:      r.status as SLAStatus,
  }));
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Scope creep detection
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Detect scope creep for a deal based on recent activity messages */
export async function generateScopeAlert(dealId: string): Promise<ScopeAlert | null> {
  const { data: activities } = await supabaseServer
    .from("activities")
    .select("description")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!activities?.length) return null;

  const messages: string[] = activities.map(
    (a: { description: string }) => a.description ?? ""
  );

  // Detect scope-expanding language
  const scopeTerms = [
    "also need",
    "while you're at it",
    "can you also",
    "add this",
    "one more thing",
    "bonus task",
    "while we're at it",
    "quick extra",
    "i thought you could",
  ];

  const matched = messages.filter((msg) =>
    scopeTerms.some((term) => msg.toLowerCase().includes(term))
  );

  if (matched.length === 0) return null;

  const severity: ScopeAlert["severity"] =
    matched.length >= 4 ? "high" : matched.length >= 2 ? "medium" : "low";

  const alert: ScopeAlert = {
    dealId,
    description: `Potential scope creep detected: ${matched.length} message(s) contain scope-expanding language.`,
    severity,
    activities: matched.slice(0, 5),
  };

  logger.warn(`[SCOPE] ${severity.toUpperCase()} scope creep on deal ${dealId}`, { matched: matched.length }, "generateScopeAlert");

  await writeAuditLog({
    event_type: "agent_action",
    entity_type: "deal",
    entity_id:   dealId,
    actor:    "system",
    payload:    { severity, matchedCount: matched.length },
  });

  return alert;
}

/** Get an SLA summary report for all active deals */
export async function getSLASummary(): Promise<{
  pending:   number;
  delivered: number;
  overdue:   number;
  disputed:  number;
}> {
  const { data } = await supabaseServer.from("sla_records").select("status");

  const summary = { pending: 0, delivered: 0, overdue: 0, disputed: 0 };
  for (const r of (data ?? []) as Array<{ status: SLAStatus }>) {
    summary[r.status] = (summary[r.status] ?? 0) + 1;
  }

  return summary;
}
