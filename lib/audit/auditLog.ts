import { supabaseServer } from "@/lib/supabaseServer";

export type AuditEventType =
  | "contract_signed"
  | "contract_created"
  | "contract_sent"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  | "auto_apply_submitted"
  | "auto_apply_rejected"
  | "tender_submitted"
  | "tender_escalated"
  | "payment_received"
  | "payment_failed"
  | "deal_stage_changed"
  | "client_created"
  | "subscription_created"
  | "subscription_cancelled"
  | "lead_qualified"
  | "lead_disqualified"
  | "sla_missed"
  | "sla_delivered"
  | "agent_action";

export type AuditPayload = Record<string, unknown>;

export interface AuditLogEntry {
  event_type: AuditEventType;
  entity_type: string;
  entity_id?: string;
  actor?: string;
  ip_address?: string;
  payload?: AuditPayload;
}

/**
 * Write an immutable audit log entry.
 * Errors are swallowed so audit failures never break the main flow.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await supabaseServer.from("audit_logs").insert({
      event_type:  entry.event_type,
      entity_type: entry.entity_type,
      entity_id:   entry.entity_id ?? null,
      actor:       entry.actor ?? "system",
      ip_address:  entry.ip_address ?? null,
      payload:     entry.payload ?? {},
    });
  } catch {
    // Never let audit failures crash the main flow
    console.error("[AUDIT] Failed to write audit log", entry.event_type);
  }
}

/**
 * Batch write multiple audit events atomically.
 */
export async function writeAuditBatch(entries: AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await supabaseServer.from("audit_logs").insert(
      entries.map((e) => ({
        event_type:  e.event_type,
        entity_type: e.entity_type,
        entity_id:   e.entity_id ?? null,
        actor:       e.actor ?? "system",
        ip_address:  e.ip_address ?? null,
        payload:     e.payload ?? {},
      }))
    );
  } catch {
    console.error("[AUDIT] Failed to write audit batch", entries.length, "entries");
  }
}

/**
 * Query audit logs for a specific entity.
 */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: string
): Promise<AuditLogEntry[]> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  return (data as AuditLogEntry[]) ?? [];
}

/**
 * Query recent audit events by type.
 */
export async function getRecentAuditEvents(
  eventType: AuditEventType,
  limit = 50
): Promise<AuditLogEntry[]> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("*")
    .eq("event_type", eventType)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as AuditLogEntry[]) ?? [];
}
