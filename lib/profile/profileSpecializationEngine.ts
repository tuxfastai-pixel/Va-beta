import { inferNiches, type NicheSignalInput } from "@/lib/profile/nicheInference";

export interface ProfileSpecializationInput extends NicheSignalInput {
  salaryRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  nicheDemand?: Array<{ niche: string; demandScore: number }>;
}

export interface ProfileConfidenceScoring {
  primaryConfidence: number;
  secondaryConfidence: number;
  dataConfidence: number;
}

export interface ProfileSpecializationResult {
  primarySpecialization: string;
  secondarySpecialization: string;
  atsKeywords: string[];
  headline: string;
  positioningTone: "authority" | "operational" | "consultative" | "growth";
  operationalStrengths: string[];
  aiCapabilityFraming: string[];
  inferredNiches: ReturnType<typeof inferNiches>;
  confidence: ProfileConfidenceScoring;
}

const SPECIALIZATION_LABELS: Record<string, string> = {
  demand_generation_operations: "Demand Generation Operations Specialist",
  campaign_operations: "Campaign Operations & CRM Reporting Specialist",
  lead_management_operations: "Lead Management Operations Specialist",
  crm_administration: "CRM Administration & Workflow Specialist",
  finance_operations: "Finance Operations & Reconciliation Specialist",
  tender_documentation: "Tender Documentation & Compliance Specialist",
  remote_operations_support: "Remote Operations Support Specialist",
  general_operations: "Operations Support Specialist",
};

const OPERATIONAL_STRENGTHS: Record<string, string[]> = {
  demand_generation_operations: ["lead lifecycle governance", "pipeline hygiene", "campaign operations"],
  campaign_operations: ["workflow automation", "report reconciliation", "SLA coordination"],
  lead_management_operations: ["lead routing", "QA validation", "delivery consistency"],
  crm_administration: ["CRM workflow design", "data hygiene", "automation mapping"],
  finance_operations: ["reconciliation", "invoice operations", "compliance support"],
  tender_documentation: ["bid packaging", "compliance checklisting", "submission control"],
  remote_operations_support: ["cross-team coordination", "documentation discipline", "ops enablement"],
  general_operations: ["execution reliability", "clear communication", "workflow consistency"],
};

function flattenKeywords(niches: ReturnType<typeof inferNiches>): string[] {
  const keywords = niches.flatMap((niche) => niche.matchedKeywords);
  return Array.from(new Set(keywords)).slice(0, 24);
}

function inferTone(primary: string): ProfileSpecializationResult["positioningTone"] {
  if (primary.includes("finance") || primary.includes("tender")) return "authority";
  if (primary.includes("campaign") || primary.includes("demand")) return "growth";
  if (primary.includes("crm")) return "consultative";
  return "operational";
}

function buildHeadline(primaryLabel: string, secondaryLabel: string): string {
  return `${primaryLabel} | ${secondaryLabel} | AI-Assisted Operations Delivery`;
}

export function runProfileSpecializationEngine(input: ProfileSpecializationInput): ProfileSpecializationResult {
  const niches = inferNiches(input);
  const primaryNiche = niches[0]?.niche ?? "general_operations";
  const secondaryNiche = niches[1]?.niche ?? "remote_operations_support";

  const primarySpecialization = SPECIALIZATION_LABELS[primaryNiche] ?? SPECIALIZATION_LABELS.general_operations;
  const secondarySpecialization = SPECIALIZATION_LABELS[secondaryNiche] ?? SPECIALIZATION_LABELS.remote_operations_support;

  const salarySignals = (input.salaryRanges ?? []).filter((item) => Number(item.max || item.min || 0) > 0).length;
  const demandSignals = (input.nicheDemand ?? []).filter((item) => Number(item.demandScore || 0) >= 0.6).length;
  const inputSignalCount = [
    (input.selectedCareers ?? []).length,
    (input.jobDescriptions ?? []).length,
    (input.successfulApplications ?? []).length,
    (input.platformPatterns ?? []).length,
    (input.skillsDetected ?? []).length,
    (input.regionalTrends ?? []).length,
    salarySignals,
    demandSignals,
  ].reduce((sum, value) => sum + value, 0);

  const primaryConfidence = Math.max(0.45, Math.min(0.97, Number((niches[0]?.confidence ?? 0.45).toFixed(2))));
  const secondaryConfidence = Math.max(0.35, Math.min(0.9, Number((niches[1]?.confidence ?? 0.4).toFixed(2))));
  const dataConfidence = Math.max(0.3, Math.min(0.98, Number((Math.min(1, inputSignalCount / 28)).toFixed(2))));

  const operationalStrengths = OPERATIONAL_STRENGTHS[primaryNiche] ?? OPERATIONAL_STRENGTHS.general_operations;
  const aiCapabilityFraming = [
    "AI-assisted reporting and reconciliation",
    "Workflow automation with quality controls",
    "Operational SLA tracking and follow-through",
  ];

  return {
    primarySpecialization,
    secondarySpecialization,
    atsKeywords: flattenKeywords(niches),
    headline: buildHeadline(primarySpecialization, secondarySpecialization),
    positioningTone: inferTone(primaryNiche),
    operationalStrengths,
    aiCapabilityFraming,
    inferredNiches: niches,
    confidence: {
      primaryConfidence,
      secondaryConfidence,
      dataConfidence,
    },
  };
}
