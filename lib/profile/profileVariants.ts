import { optimizeATSProfile, type ATSPlatform, type ATSOptimizationResult } from "@/lib/profile/atsOptimizationEngine";

export type ProfileVariantKey =
  | "linkedin_profile"
  | "indeed_profile"
  | "flexjobs_profile"
  | "tender_profile"
  | "freelance_profile"
  | "sales_profile"
  | "finance_profile";

export interface ProfileVariant {
  key: ProfileVariantKey;
  label: string;
  channel: ATSPlatform | "tender" | "freelance" | "sales" | "finance";
  optimizedHeadline: string;
  summary: string;
  prioritizedKeywords: string[];
  deploymentWeight: number;
  appliedThrottle: number;
}

export interface BuildProfileVariantsInput {
  headline: string;
  primarySpecialization: string;
  secondarySpecialization: string;
  atsKeywords: string[];
  operationalStrengths: string[];
  aiCapabilityFraming: string[];
  identityLabel: string;
  recommendedMarketFocus?: string;
  adaptationThrottle: number;
  atsReshapeThrottle: number;
}

function trimForThrottle(values: string[], throttle: number, min: number, max: number): string[] {
  const size = Math.max(min, Math.min(max, Math.round(values.length * throttle)));
  return values.slice(0, size);
}

function buildBase(platform: ATSPlatform, input: BuildProfileVariantsInput): ATSOptimizationResult {
  return optimizeATSProfile({
    platform,
    headline: input.headline,
    specialization: input.primarySpecialization,
    secondarySpecialization: input.secondarySpecialization,
    baseKeywords: input.atsKeywords,
    operationalStrengths: input.operationalStrengths,
    aiCapabilityFraming: input.aiCapabilityFraming,
  });
}

export function buildProfileVariants(input: BuildProfileVariantsInput): Record<ProfileVariantKey, ProfileVariant> {
  const linkedin = buildBase("linkedin", input);
  const indeed = buildBase("indeed", input);
  const flexjobs = buildBase("flexjobs", input);
  const generic = buildBase("generic", input);

  const keywordThrottle = Math.max(0.4, Math.min(1, input.adaptationThrottle * input.atsReshapeThrottle));

  const linkedinKeywords = trimForThrottle(linkedin.prioritizedKeywords, keywordThrottle, 8, 18);
  const indeedKeywords = trimForThrottle(indeed.prioritizedKeywords, keywordThrottle, 10, 24);
  const flexKeywords = trimForThrottle(flexjobs.prioritizedKeywords, keywordThrottle, 9, 20);
  const baseKeywords = trimForThrottle(generic.prioritizedKeywords, keywordThrottle, 8, 20);

  const tenderKeywords = trimForThrottle([
    ...baseKeywords,
    "tender",
    "rfp",
    "rfq",
    "compliance",
    "submission control",
    "bid documentation",
  ], keywordThrottle, 10, 22);

  const freelanceKeywords = trimForThrottle([
    ...baseKeywords,
    "client communication",
    "fast turnaround",
    "scope clarity",
    "independent execution",
  ], keywordThrottle, 10, 22);

  const salesKeywords = trimForThrottle([
    ...linkedinKeywords,
    "pipeline growth",
    "lead conversion",
    "client retention",
    "revenue operations",
  ], keywordThrottle, 10, 22);

  const financeKeywords = trimForThrottle([
    ...indeedKeywords,
    "reconciliation",
    "invoice control",
    "audit readiness",
    "financial reporting",
  ], keywordThrottle, 10, 22);

  const marketFocus = input.recommendedMarketFocus || input.identityLabel;

  return {
    linkedin_profile: {
      key: "linkedin_profile",
      label: "LinkedIn Authority Profile",
      channel: "linkedin",
      optimizedHeadline: linkedin.optimizedHeadline,
      summary: `${linkedin.summary} Positioned for ${marketFocus}.`,
      prioritizedKeywords: linkedinKeywords,
      deploymentWeight: 1,
      appliedThrottle: keywordThrottle,
    },
    indeed_profile: {
      key: "indeed_profile",
      label: "Indeed ATS Profile",
      channel: "indeed",
      optimizedHeadline: indeed.optimizedHeadline,
      summary: indeed.summary,
      prioritizedKeywords: indeedKeywords,
      deploymentWeight: 1,
      appliedThrottle: keywordThrottle,
    },
    flexjobs_profile: {
      key: "flexjobs_profile",
      label: "FlexJobs Remote Profile",
      channel: "flexjobs",
      optimizedHeadline: flexjobs.optimizedHeadline,
      summary: flexjobs.summary,
      prioritizedKeywords: flexKeywords,
      deploymentWeight: 0.95,
      appliedThrottle: keywordThrottle,
    },
    tender_profile: {
      key: "tender_profile",
      label: "Tender Compliance Profile",
      channel: "tender",
      optimizedHeadline: `${input.primarySpecialization} | Tender & Compliance Delivery`,
      summary: `${generic.summary} Structured for compliance-led submission workflows and document control.`,
      prioritizedKeywords: tenderKeywords,
      deploymentWeight: 0.85,
      appliedThrottle: keywordThrottle,
    },
    freelance_profile: {
      key: "freelance_profile",
      label: "Freelance Conversion Profile",
      channel: "freelance",
      optimizedHeadline: `${input.primarySpecialization} | Freelance Delivery & Client Outcomes`,
      summary: `${generic.summary} Adapted for freelance conversion and fast delivery cadence.`,
      prioritizedKeywords: freelanceKeywords,
      deploymentWeight: 0.9,
      appliedThrottle: keywordThrottle,
    },
    sales_profile: {
      key: "sales_profile",
      label: "Sales Operations Profile",
      channel: "sales",
      optimizedHeadline: `${input.primarySpecialization} | Sales Ops | Pipeline Reliability`,
      summary: `${linkedin.summary} Tuned for demand and revenue-linked execution.`,
      prioritizedKeywords: salesKeywords,
      deploymentWeight: 0.88,
      appliedThrottle: keywordThrottle,
    },
    finance_profile: {
      key: "finance_profile",
      label: "Finance Operations Profile",
      channel: "finance",
      optimizedHeadline: `${input.primarySpecialization} | Finance Operations | Audit-Ready Execution`,
      summary: `${indeed.summary} Tuned for finance accuracy, controls, and reporting trust.`,
      prioritizedKeywords: financeKeywords,
      deploymentWeight: 0.88,
      appliedThrottle: keywordThrottle,
    },
  };
}
