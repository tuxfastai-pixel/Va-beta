export interface NicheSignalInput {
  selectedCareers?: string[];
  jobDescriptions?: string[];
  successfulApplications?: string[];
  platformPatterns?: string[];
  skillsDetected?: string[];
  regionalTrends?: string[];
}

export interface InferredNiche {
  niche: string;
  score: number;
  confidence: number;
  matchedKeywords: string[];
}

const NICHE_KEYWORDS: Record<string, string[]> = {
  demand_generation_operations: [
    "lead",
    "campaign",
    "salesforce",
    "hubspot",
    "pipeline",
    "conversion",
    "mql",
  ],
  campaign_operations: [
    "campaign",
    "reporting",
    "qa",
    "automation",
    "pacing",
    "attribution",
  ],
  lead_management_operations: [
    "lead delivery",
    "lead ops",
    "enrichment",
    "routing",
    "crm",
    "sla",
  ],
  crm_administration: [
    "crm",
    "salesforce",
    "zoho",
    "pipeline hygiene",
    "workflow",
    "admin",
  ],
  finance_operations: [
    "reconciliation",
    "bookkeeping",
    "invoice",
    "audit",
    "compliance",
    "finance",
  ],
  tender_documentation: [
    "tender",
    "bid",
    "compliance pack",
    "submission",
    "rfp",
    "rfq",
  ],
  remote_operations_support: [
    "remote",
    "coordination",
    "operations",
    "support",
    "process",
    "documentation",
  ],
};

function normalize(items: string[] = []): string[] {
  return items
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean);
}

export function inferNiches(input: NicheSignalInput): InferredNiche[] {
  const pool = normalize([
    ...(input.selectedCareers ?? []),
    ...(input.jobDescriptions ?? []),
    ...(input.successfulApplications ?? []),
    ...(input.platformPatterns ?? []),
    ...(input.skillsDetected ?? []),
    ...(input.regionalTrends ?? []),
  ]);

  const blob = pool.join(" ");
  if (!blob) {
    return [{ niche: "general_operations", score: 1, confidence: 0.3, matchedKeywords: [] }];
  }

  const niches: InferredNiche[] = [];
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    const matched = keywords.filter((keyword) => blob.includes(keyword));
    if (matched.length === 0) continue;

    const score = matched.length + matched.reduce((sum, keyword) => sum + (blob.split(keyword).length - 1), 0) * 0.2;
    const confidence = Math.max(0.35, Math.min(0.95, Number((matched.length / keywords.length).toFixed(2))));

    niches.push({
      niche,
      score: Number(score.toFixed(2)),
      confidence,
      matchedKeywords: matched,
    });
  }

  if (niches.length === 0) {
    return [{ niche: "general_operations", score: 1, confidence: 0.35, matchedKeywords: [] }];
  }

  return niches.sort((a, b) => b.score - a.score);
}
