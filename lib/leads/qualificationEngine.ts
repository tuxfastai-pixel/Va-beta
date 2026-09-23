/**
 * Lead Qualification + Risk Scoring Engine
 * Writes to / reads from the `lead_scores` table (created in 20260508_rls_and_audit.sql).
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { logger } from "@/lib/logger/logger";

export type QualificationStatus =
  | "unscored"
  | "qualified"
  | "needs_review"
  | "disqualified";

export type RiskFlag =
  | "no_budget"
  | "unrealistic_scope"
  | "bad_communication"
  | "similar_client_churn"
  | "low_trust_signals"
  | "payment_risk"
  | "scope_ambiguity";

export interface LeadScoreInput {
  leadId:            string;
  /** Estimated budget in USD */
  budget?:           number;
  /** Job / project description */
  description?:      string;
  /** Platform sourced from */
  platform?:         string;
  /** Raw message or job post to analyse */
  rawText?:          string;
  /** Any known signals about the client */
  clientSignals?:    Record<string, unknown>;
}

export interface LeadScoreResult {
  leadId:            string;
  trustScore:        number;  // 0-100
  riskScore:         number;  // 0-100
  qualification:     QualificationStatus;
  depositRequired:   boolean;
  flags:             RiskFlag[];
  disqualifyReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeTrustScore(input: LeadScoreInput): number {
  let score = 50;

  if (input.budget && input.budget > 1000) score += 15;
  if (input.budget && input.budget > 5000) score += 10;

  const text = (input.rawText ?? "").toLowerCase();

  // Positive trust signals
  if (text.includes("company") || text.includes("registered"))    score += 8;
  if (text.includes("contract") || text.includes("agreement"))    score += 6;
  if (text.includes("ongoing") || text.includes("long-term"))     score += 5;
  if (text.includes("invoice") || text.includes("payment terms")) score += 5;
  if (text.includes("linkedin") || text.includes("verified"))     score += 4;

  // Platform trust bonuses
  if (input.platform) {
    const trusted = ["linkedin", "pnet", "careers24", "careerjunction"];
    if (trusted.includes(input.platform.toLowerCase())) score += 6;
  }

  // Negative trust signals
  if (text.includes("asap") && text.includes("free"))   score -= 15;
  if (text.includes("no budget"))                        score -= 20;
  if (text.includes("willing to work for exposure"))     score -= 25;
  if (text.includes("quick") && text.includes("cheap")) score -= 10;

  return Math.min(100, Math.max(0, score));
}

function computeRiskScore(input: LeadScoreInput): number {
  let score = 20; // Start low-risk

  const text = (input.rawText ?? "").toLowerCase();

  if (!input.budget || input.budget < 300) score += 20;
  if (text.includes("asap") || text.includes("urgent")) score += 10;
  if (text.includes("change") && text.includes("require")) score += 8;
  if (text.length > 0 && text.length < 80) score += 10; // Vague brief
  if (text.includes("similar to") || text.includes("like someone else")) score += 8;

  return Math.min(100, Math.max(0, score));
}

function deriveFlags(input: LeadScoreInput, trust: number, risk: number): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const text = (input.rawText ?? "").toLowerCase();

  if (!input.budget || input.budget < 300)   flags.push("no_budget");
  if (trust < 35)                            flags.push("low_trust_signals");
  if (risk  > 60)                            flags.push("payment_risk");
  if (text.length < 80)                      flags.push("scope_ambiguity");
  if (text.includes("asap") && risk > 40)    flags.push("unrealistic_scope");

  return flags;
}

function deriveQualification(
  trust: number,
  risk: number,
  flags: RiskFlag[],
  budget?: number
): { qualification: QualificationStatus; disqualifyReason?: string } {
  if (trust < 25 || flags.includes("no_budget")) {
    return { qualification: "disqualified", disqualifyReason: "Insufficient trust signals or no stated budget" };
  }
  if (risk > 70) {
    return { qualification: "disqualified", disqualifyReason: "Risk score exceeds threshold (>70)" };
  }
  if (trust < 45 || risk > 45 || flags.length >= 2) {
    return { qualification: "needs_review" };
  }
  return { qualification: "qualified" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Score and persist a lead. Safe to call multiple times — upserts. */
export async function qualifyLead(input: LeadScoreInput): Promise<LeadScoreResult> {
  const trustScore = computeTrustScore(input);
  const riskScore  = computeRiskScore(input);
  const flags      = deriveFlags(input, trustScore, riskScore);
  const { qualification, disqualifyReason } = deriveQualification(
    trustScore, riskScore, flags, input.budget
  );
  const depositRequired = riskScore > 40 || qualification === "needs_review";

  const result: LeadScoreResult = {
    leadId:          input.leadId,
    trustScore,
    riskScore,
    qualification,
    depositRequired,
    flags,
    disqualifyReason,
  };

  try {
    await supabaseServer.from("lead_scores").upsert(
      {
        lead_id:          input.leadId,
        budget_verified:  Boolean(input.budget && input.budget > 0),
        trust_score:      trustScore,
        risk_score:       riskScore,
        qualification,
        disqualify_reason: disqualifyReason ?? null,
        deposit_required: depositRequired,
        flags:            flags as string[],
      },
      { onConflict: "lead_id" }
    );
  } catch (e) {
    logger.warn("[QUALIFY] Failed to persist lead score", { leadId: input.leadId }, "qualifyLead");
  }

  if (qualification === "disqualified") {
    await writeAuditLog({
      eventType:  "lead_qualified",
      entityType: "lead",
      entityId:   input.leadId,
      actorId:    "system",
      payload:    { qualification, disqualifyReason },
    });
  }

  logger.info(`[QUALIFY] Lead ${input.leadId}: trust=${trustScore} risk=${riskScore} → ${qualification}`, {}, "qualifyLead");
  return result;
}

/** Force-disqualify a lead with a manual reason */
export async function disqualifyLead(leadId: string, reason: string): Promise<void> {
  await supabaseServer.from("lead_scores").upsert(
    { lead_id: leadId, qualification: "disqualified", disqualify_reason: reason },
    { onConflict: "lead_id" }
  );

  await writeAuditLog({
    eventType:  "lead_qualified",
    entityType: "lead",
    entityId:   leadId,
    actorId:    "system",
    payload:    { qualification: "disqualified", reason },
  });
}

/** Set deposit-required flag on a lead */
export async function requireDeposit(leadId: string): Promise<void> {
  await supabaseServer
    .from("lead_scores")
    .upsert({ lead_id: leadId, deposit_required: true }, { onConflict: "lead_id" });
}

/** Fetch the current score for a lead */
export async function getLeadScore(leadId: string): Promise<LeadScoreResult | null> {
  const { data } = await supabaseServer
    .from("lead_scores")
    .select("*")
    .eq("lead_id", leadId)
    .single();

  if (!data) return null;

  return {
    leadId:          data.lead_id,
    trustScore:      data.trust_score,
    riskScore:       data.risk_score,
    qualification:   data.qualification,
    depositRequired: data.deposit_required,
    flags:           (data.flags ?? []) as RiskFlag[],
    disqualifyReason: data.disqualify_reason ?? undefined,
  };
}

/** Get all leads that need human review */
export async function getLeadsNeedingReview(): Promise<string[]> {
  const { data } = await supabaseServer
    .from("lead_scores")
    .select("lead_id")
    .eq("qualification", "needs_review");

  return data?.map((r: { lead_id: string }) => r.lead_id) ?? [];
}
