export type ATSPlatform = "linkedin" | "indeed" | "flexjobs" | "pnet" | "careerjunction" | "careers24" | "generic";

export interface ATSOptimizationInput {
  platform: ATSPlatform;
  headline: string;
  specialization: string;
  secondarySpecialization?: string;
  baseKeywords: string[];
  operationalStrengths: string[];
  aiCapabilityFraming: string[];
}

export interface ATSOptimizationResult {
  platform: ATSPlatform;
  optimizedHeadline: string;
  summary: string;
  prioritizedKeywords: string[];
  tone: "branding" | "keyword_dense" | "remote_ops" | "balanced";
}

const PLATFORM_PRIORITIES: Record<ATSPlatform, { tone: ATSOptimizationResult["tone"]; boost: string[]; maxKeywords: number }> = {
  linkedin: {
    tone: "branding",
    boost: ["strategy", "impact", "stakeholder management", "operational leadership"],
    maxKeywords: 18,
  },
  indeed: {
    tone: "keyword_dense",
    boost: ["operations", "crm", "excel", "reporting", "workflow", "tool proficiency"],
    maxKeywords: 24,
  },
  flexjobs: {
    tone: "remote_ops",
    boost: ["remote operations", "asynchronous communication", "self-management", "workflow coordination"],
    maxKeywords: 20,
  },
  pnet: {
    tone: "balanced",
    boost: ["operations", "compliance", "crm", "admin"],
    maxKeywords: 20,
  },
  careerjunction: {
    tone: "balanced",
    boost: ["operations", "crm", "reporting", "delivery"],
    maxKeywords: 20,
  },
  careers24: {
    tone: "balanced",
    boost: ["operations", "admin", "client support", "workflow"],
    maxKeywords: 20,
  },
  generic: {
    tone: "balanced",
    boost: ["operations", "execution", "communication", "automation"],
    maxKeywords: 20,
  },
};

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.toLowerCase().trim()).filter(Boolean)));
}

function buildSummary(input: ATSOptimizationInput, tone: ATSOptimizationResult["tone"]): string {
  if (tone === "branding") {
    return `${input.specialization} focused on measurable outcomes, stakeholder trust, and AI-assisted execution discipline.`;
  }
  if (tone === "keyword_dense") {
    return `${input.specialization} with hands-on delivery across ${input.operationalStrengths.join(", ")}, plus AI-assisted reporting and workflow execution.`;
  }
  if (tone === "remote_ops") {
    return `${input.specialization} delivering remote-first execution through strong self-management, workflow coordination, and clear async communication.`;
  }

  return `${input.specialization} with practical strengths in ${input.operationalStrengths.join(", ")} and AI-assisted operational delivery.`;
}

export function optimizeATSProfile(input: ATSOptimizationInput): ATSOptimizationResult {
  const priority = PLATFORM_PRIORITIES[input.platform] ?? PLATFORM_PRIORITIES.generic;
  const prioritizedKeywords = uniqueList([
    ...input.baseKeywords,
    ...input.operationalStrengths,
    ...input.aiCapabilityFraming,
    ...priority.boost,
  ]).slice(0, priority.maxKeywords);

  const optimizedHeadline =
    input.platform === "linkedin"
      ? `${input.specialization} | Revenue-Focused Operations | ${input.secondarySpecialization ?? "AI-Assisted Delivery"}`
      : input.platform === "indeed"
        ? `${input.specialization} | CRM | Reporting | Workflow Automation`
        : input.platform === "flexjobs"
          ? `${input.specialization} | Remote Operations | Workflow Coordination`
          : input.headline;

  return {
    platform: input.platform,
    optimizedHeadline,
    summary: buildSummary(input, priority.tone),
    prioritizedKeywords,
    tone: priority.tone,
  };
}
