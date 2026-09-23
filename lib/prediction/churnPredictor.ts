import { supabaseServer } from "@/lib/supabaseServer";

export interface ChurnRiskSignal {
  key: string;
  value: number;
  reason: string;
}

export interface ClientChurnAssessment {
  clientId: string;
  clientName: string;
  riskScore: number;
  riskBand: "low" | "medium" | "high";
  ghostingRisk: number;
  engagementDropRisk: number;
  paymentRisk: number;
  signals: ChurnRiskSignal[];
  nextBestAction: string;
}

function daysSince(input?: string | null): number {
  if (!input) return 999;
  const then = new Date(input).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86400000));
}

function riskBand(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export async function assessClientChurn(clientId: string): Promise<ClientChurnAssessment | null> {
  const { data: client } = await supabaseServer
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return null;

  const { data: deals } = await supabaseServer
    .from("deals")
    .select("id")
    .eq("client_id", clientId);

  const dealIds = (deals ?? [])
    .map((deal) => (deal as { id: string }).id)
    .filter(Boolean);

  const invoiceDealIds =
    dealIds.length > 0
      ? dealIds
      : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: invoices }, { data: subscriptions }] = await Promise.all([
    supabaseServer
      .from("invoices")
      .select("status, due_date, paid_at, created_at")
      .in("deal_id", invoiceDealIds),
    supabaseServer
      .from("subscriptions")
      .select("status, amount, updated_at")
      .eq("client_id", clientId),
  ]);
  const { data: activities } = dealIds.length > 0
    ? await supabaseServer
      .from("activities")
      .select("type, created_at")
      .in("deal_id", dealIds)
      .order("created_at", { ascending: false })
      .limit(50)
    : { data: [] as Array<{ type: string; created_at: string }> };

  const latestActivity = (activities ?? [])[0] as { created_at?: string } | undefined;
  const daysSinceEngagement = daysSince(latestActivity?.created_at);

  const overdueInvoices = (invoices ?? []).filter((row) => String((row as { status?: string }).status) === "overdue");
  const pendingAged = (invoices ?? []).filter((row) => {
    const invoice = row as { status?: string; created_at?: string };
    return String(invoice.status) === "pending" && daysSince(invoice.created_at) > 21;
  });

  const cancelledSubscriptions = (subscriptions ?? []).filter((row) => String((row as { status?: string }).status) === "cancelled").length;

  const ghostingRisk = Math.min(100, daysSinceEngagement * 2);
  const engagementDropRisk = Math.min(100, Math.max(0, (daysSinceEngagement - 5) * 3));
  const paymentRisk = Math.min(100, overdueInvoices.length * 25 + pendingAged.length * 15 + cancelledSubscriptions * 20);

  const blended = Math.round(ghostingRisk * 0.35 + engagementDropRisk * 0.25 + paymentRisk * 0.4);
  const signals: ChurnRiskSignal[] = [];

  if (daysSinceEngagement > 10) {
    signals.push({ key: "ghosting_clients", value: daysSinceEngagement, reason: `No engagement for ${daysSinceEngagement} days` });
  }
  if (overdueInvoices.length > 0) {
    signals.push({ key: "payment_risk", value: overdueInvoices.length, reason: `${overdueInvoices.length} overdue invoice(s)` });
  }
  if (pendingAged.length > 0) {
    signals.push({ key: "declining_engagement", value: pendingAged.length, reason: `${pendingAged.length} pending invoices older than 21 days` });
  }

  const action = blended >= 70
    ? "Escalate immediately: deposit-first policy + direct retention call"
    : blended >= 40
      ? "Run retention sequence: milestone recap + payment reminder"
      : "Continue standard follow-up cadence";

  return {
    clientId,
    clientName: String((client as { name?: string }).name || "Unknown client"),
    riskScore: blended,
    riskBand: riskBand(blended),
    ghostingRisk,
    engagementDropRisk,
    paymentRisk,
    signals,
    nextBestAction: action,
  };
}

export async function getTopChurnRisks(limit = 10): Promise<ClientChurnAssessment[]> {
  const { data: clients } = await supabaseServer
    .from("clients")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(200);

  const assessments = await Promise.all(
    (clients ?? []).map(async (row) => assessClientChurn((row as { id: string }).id))
  );

  return assessments
    .filter((item): item is ClientChurnAssessment => Boolean(item))
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, limit);
}

export async function predictChurn(limit = 10): Promise<ClientChurnAssessment[]> {
  return getTopChurnRisks(limit);
}
