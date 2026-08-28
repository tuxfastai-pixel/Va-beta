import { classifyDeal } from "@/lib/ai/dealClassifier";
import { calculateTrustScore } from "@/lib/ai/trustEngine";
import { calculateRiskScore } from "@/lib/ai/riskEngine";
import { estimateClientValue } from "@/lib/ai/clientValue";
import { qualifyClient } from "@/lib/ai/qualificationEngine";
import { choosePricingStrategy } from "@/lib/ai/pricingStrategy";
import { suggestPrice } from "@/lib/ai/pricingEngine";
import { generateProposal } from "@/lib/jobs/winningProposal";
import { logApplication } from "@/lib/office/automations";
import { applyToJobAction } from "@/lib/actions/apply";
import { detectFinanceJob } from "@/lib/finance/financeEngine";
import { parseTender, scoreTender } from "@/lib/gov/tenderParser";

function isGovernmentOpportunity(job: Record<string, unknown>) {
  const platform = String(job.platform || "").toLowerCase();
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();

  return (
    platform.includes("etender") ||
    platform.includes("treasury") ||
    platform.includes("csd") ||
    text.includes("rfq") ||
    text.includes("request for quotation")
  );
}

export async function processJob(
  user: {
    id: string;
    careers: string[];
    primary_career?: string | null;
    safe_mode?: boolean | null;
    resume?: string | null;
    profile?: string | null;
    provider?: string | null;
    jobTrackerId?: string | null;
    crmSheetId?: string | null;
  },
  job: Record<string, unknown>
) {
  if (isGovernmentOpportunity(job)) {
    const parsed = parseTender({
      id: String(job.id || ""),
      title: String(job.title || ""),
      description: String(job.description || ""),
      department: String((job.department as string | undefined) || ""),
      closingDate: String((job.closingDate as string | undefined) || ""),
    });

    return {
      status: "manual_review_required",
      reason: "government_tender",
      tender: parsed,
      tenderScore: scoreTender(parsed),
    };
  }

  const client = (job.client as Record<string, unknown> | undefined) || {};
  const trust = calculateTrustScore(client);
  const risk = calculateRiskScore({ description: String(job.description || "") }, client);

  if (risk > 70) {
    return { status: "avoided", reason: "high_risk" };
  }

  const value = estimateClientValue(client);
  const qualification = qualifyClient({ trust, risk, value });

  if (qualification === "avoid") {
    return { status: "avoided", reason: "qualified_avoid" };
  }

  const deal = classifyDeal({
    title: String(job.title || ""),
    description: String(job.description || ""),
    budget: (job.budget as { min?: number; max?: number } | undefined) || undefined,
  });

  const primaryCareer = String(user.primary_career || user.careers[0] || "general");
  const price = suggestPrice(deal, primaryCareer);
  const strategy = choosePricingStrategy(deal);
  const financeCategory = detectFinanceJob({ description: String(job.description || "") }) ? "finance" : "general";
  const proposal = generateProposal(
    {
      title: String(job.title || ""),
      description: String(job.description || ""),
      budget: Number((job.budget as { max?: unknown } | undefined)?.max || 0),
    },
    {
      careers: user.careers,
      primary_career: primaryCareer,
    },
    { price, strategy }
  );

  await applyToJobAction(
    {
      id: user.id,
      resume: user.resume,
      profile: user.profile,
    },
    {
      id: String(job.id || ""),
      title: String(job.title || ""),
      description: String(job.description || ""),
      client_response: "awaiting_response",
    },
    Boolean(user.safe_mode ?? true)
  );

  await logApplication(
    {
      id: user.id,
      provider: String(user.provider || "google"),
      jobTrackerId: String(user.jobTrackerId || ""),
    },
    {
      platform: String(job.platform || "unknown"),
      title: String(job.title || "Untitled"),
      budget: (job.budget as { max?: number } | undefined) || undefined,
    }
  );

  return {
    status: "processed",
    trust,
    risk,
    value,
    category: financeCategory,
    strategy,
    proposal,
    recommendedPrice: price.recommended,
  };
}
