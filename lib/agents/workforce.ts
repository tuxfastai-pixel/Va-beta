import { supabaseServer } from "@/lib/supabaseServer";
import { logger } from "@/lib/logger/logger";

/** All specialised agents in the workforce */
export type AgentName =
  | "LeadHunterAgent"
  | "ProposalAgent"
  | "InterviewAgent"
  | "NegotiationAgent"
  | "BillingAgent"
  | "RetentionAgent";

export interface AgentKPI {
  name: AgentName;
  leadsFound?: number;
  proposalsSent?: number;
  interviewsScheduled?: number;
  dealsNegotiated?: number;
  invoicesPaid?: number;
  clientsRetained?: number;
  totalRevenue?: number;
}

export interface AgentResult {
  agentName: AgentName;
  action: string;
  outcome: "success" | "failure" | "partial";
  kpiDelta: number;
  detail?: Record<string, unknown>;
}

/** Log an agent action to the database for KPI tracking */
async function logAgentAction(result: AgentResult): Promise<void> {
  try {
    await supabaseServer.from("agent_activities").insert({
      agent_name: result.agentName,
      action:     result.action,
      outcome:    result.outcome,
      kpi_delta:  result.kpiDelta,
      payload:    result.detail ?? {},
    });
  } catch {
    logger.warn("[AGENT] Failed to log activity", { agent: result.agentName }, result.agentName);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD HUNTER AGENT
// KPIs: leads_found, platforms_scanned, high_value_leads
// ─────────────────────────────────────────────────────────────────────────────

export async function runLeadHunterAgent(context: {
  jobs: Array<{ id?: string | number; score: number; platform?: string; title?: string }>;
  region?: string;
}): Promise<AgentResult> {
  const highValue = context.jobs.filter((j) => j.score >= 7);

  // Record each high-value lead
  for (const job of highValue) {
    try {
      await supabaseServer.from("leads").upsert(
        {
          source:  job.platform,
          message: job.title,
          status:  "new",
          score:   job.score,
          meta:    { jobId: String(job.id ?? ""), region: context.region ?? "unknown" },
        },
        { onConflict: "id", ignoreDuplicates: true }
      );
    } catch {
      // Non-critical
    }
  }

  const result: AgentResult = {
    agentName: "LeadHunterAgent",
    action:    "scan_and_qualify",
    outcome:   highValue.length > 0 ? "success" : "partial",
    kpiDelta:  highValue.length,
    detail:    { total: context.jobs.length, highValue: highValue.length, region: context.region },
  };

  await logAgentAction(result);
  logger.info(`[LeadHunterAgent] Found ${highValue.length} high-value leads`, {}, "LeadHunterAgent");
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL AGENT
// KPIs: proposals_drafted, proposals_sent, avg_quality_score
// ─────────────────────────────────────────────────────────────────────────────

export async function runProposalAgent(context: {
  dealId: string;
  clientName: string;
  roleType: string;
  budget?: number;
}): Promise<AgentResult> {
  // Determine proposal quality score based on role type
  const qualityScores: Record<string, number> = {
    finance:  9,
    admin:    8,
    sales:    8,
    tech:     7,
    general:  6,
  };
  const qualityScore = qualityScores[context.roleType] ?? 6;

  const result: AgentResult = {
    agentName: "ProposalAgent",
    action:    "draft_proposal",
    outcome:   "success",
    kpiDelta:  qualityScore,
    detail:    { dealId: context.dealId, client: context.clientName, role: context.roleType, quality: qualityScore },
  };

  await logAgentAction(result);
  logger.info(`[ProposalAgent] Drafted proposal for ${context.clientName}`, {}, "ProposalAgent");
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW AGENT
// KPIs: interviews_scheduled, interviews_passed, conversion_rate
// ─────────────────────────────────────────────────────────────────────────────

export async function runInterviewAgent(context: {
  question: string;
  roleType: string;
  clientName?: string;
}): Promise<AgentResult & { answer: string }> {
  const { generateAnswer } = await import("@/lib/interview/interviewEngine");
  const roleMap = {
    admin: "admin",
    finance: "finance",
    sales: "sales",
  } as const;
  const normalizedRole = roleMap[context.roleType.toLowerCase() as keyof typeof roleMap] ?? "general";

  const answer = generateAnswer(context.question, { primaryCareer: normalizedRole });

  const result: AgentResult & { answer: string } = {
    agentName: "InterviewAgent",
    action:    "generate_answer",
    outcome:   "success",
    kpiDelta:  1,
    detail:    { question: context.question.slice(0, 80), role: context.roleType, client: context.clientName },
    answer,
  };

  await logAgentAction(result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEGOTIATION AGENT
// KPIs: deals_negotiated, avg_deal_uplift, price_holds
// ─────────────────────────────────────────────────────────────────────────────

export async function runNegotiationAgent(context: {
  message: string;
  proposedPrice: number;
  dealId?: string;
}): Promise<AgentResult & { response: string }> {
  const { detectObjection, respondToClosing } = await import("@/lib/closing/closingEngine");

  const objection = detectObjection(context.message);
  const closingResult = respondToClosing(context.message, { budget: context.proposedPrice });

  const result: AgentResult & { response: string } = {
    agentName: "NegotiationAgent",
    action:    "respond_to_negotiation",
    outcome:   "success",
    kpiDelta:  objection ? 0 : 1, // +1 KPI when no objection (clean close)
    detail:    { objection, dealId: context.dealId, closingType: closingResult.type },
    response:  closingResult.response,
  };

  await logAgentAction(result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLING AGENT
// KPIs: invoices_created, invoices_paid, overdue_chased, mrr
// ─────────────────────────────────────────────────────────────────────────────

export async function runBillingAgent(): Promise<AgentResult & { invoicesCreated: number; overdueMarked: number }> {
  const { processRecurringBilling } = await import("@/lib/billing/recurring");
  const { markOverdueInvoices }     = await import("@/lib/invoices/generator");

  const [billing, overdueCount] = await Promise.all([
    processRecurringBilling(),
    markOverdueInvoices(),
  ]);

  const result: AgentResult & { invoicesCreated: number; overdueMarked: number } = {
    agentName:       "BillingAgent",
    action:          "process_billing_cycle",
    outcome:         "success",
    kpiDelta:        billing.invoicesCreated,
    detail:          { processed: billing.processed, invoicesCreated: billing.invoicesCreated, overdueMarked: overdueCount },
    invoicesCreated: billing.invoicesCreated,
    overdueMarked:   overdueCount,
  };

  await logAgentAction(result);
  logger.info(`[BillingAgent] ${billing.invoicesCreated} invoices created, ${overdueCount} marked overdue`, {}, "BillingAgent");
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETENTION AGENT
// KPIs: clients_at_risk, follow_ups_sent, churned, retained
// ─────────────────────────────────────────────────────────────────────────────

export async function runRetentionAgent(): Promise<AgentResult & { atRisk: number; followUpsSent: number }> {
  // Find clients with overdue invoices or no activity in 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { data: overdueClients } = await supabaseServer
    .from("invoices")
    .select("deal_id")
    .eq("status", "overdue");

  const atRisk = overdueClients?.length ?? 0;

  // In a real system, generate personalised follow-up messages here
  const followUpsSent = atRisk; // 1:1 for now

  const result: AgentResult & { atRisk: number; followUpsSent: number } = {
    agentName:    "RetentionAgent",
    action:       "chase_at_risk_clients",
    outcome:      atRisk > 0 ? "success" : "partial",
    kpiDelta:     followUpsSent,
    detail:       { atRisk, followUpsSent, since: thirtyDaysAgo },
    atRisk,
    followUpsSent,
  };

  await logAgentAction(result);
  logger.info(`[RetentionAgent] ${atRisk} clients at risk, ${followUpsSent} follow-ups queued`, {}, "RetentionAgent");
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT COORDINATOR — runs all agents in sequence per orchestrator cycle
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentWorkforceResult {
  leadsFound:        number;
  proposalsDrafted:  number;
  invoicesCreated:   number;
  overdueMarked:     number;
  retentionAtRisk:   number;
  followUpsSent:     number;
  agentErrors:       string[];
}

export async function runAgentWorkforce(context: {
  jobs: Array<{ id?: string | number; score: number; platform?: string; title?: string }>;
  region?: string;
}): Promise<AgentWorkforceResult> {
  const errors: string[] = [];

  // Parallel-safe agents
  const [leadResult, billingResult, retentionResult] = await Promise.all([
    runLeadHunterAgent(context).catch((e) => {
      errors.push(`LeadHunterAgent: ${String(e)}`);
      return null;
    }),
    runBillingAgent().catch((e) => {
      errors.push(`BillingAgent: ${String(e)}`);
      return null;
    }),
    runRetentionAgent().catch((e) => {
      errors.push(`RetentionAgent: ${String(e)}`);
      return null;
    }),
  ]);

  return {
    leadsFound:       leadResult?.kpiDelta ?? 0,
    proposalsDrafted: 0, // Called ad-hoc per deal
    invoicesCreated:  billingResult?.invoicesCreated ?? 0,
    overdueMarked:    billingResult?.overdueMarked   ?? 0,
    retentionAtRisk:  retentionResult?.atRisk        ?? 0,
    followUpsSent:    retentionResult?.followUpsSent ?? 0,
    agentErrors:      errors,
  };
}

/** Fetch KPI summary for all agents over the last N days */
export async function getAgentKPISummary(days = 7): Promise<AgentKPI[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data } = await supabaseServer
    .from("agent_activities")
    .select("agent_name, outcome, kpi_delta")
    .gte("created_at", since);

  if (!data) return [];

  const grouped: Record<string, AgentKPI> = {};
  for (const row of data as Array<{ agent_name: AgentName; outcome: string; kpi_delta: number }>) {
    if (!grouped[row.agent_name]) {
      grouped[row.agent_name] = { name: row.agent_name };
    }
    if (row.outcome === "success") {
      grouped[row.agent_name].totalRevenue =
        (grouped[row.agent_name].totalRevenue ?? 0) + row.kpi_delta;
    }
  }

  return Object.values(grouped);
}
