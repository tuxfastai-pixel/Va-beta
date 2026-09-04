import type { ProfileVariantKey } from "@/lib/profile/profileVariants";
import type { ResumeArtifact } from "@/lib/resume/resumeGenerator";

export type ResumeVariantKey =
  | "indeed_resume"
  | "linkedin_resume"
  | "flexjobs_resume"
  | "tender_resume"
  | "freelance_resume"
  | "corporate_operations_resume";

export interface ResumeVariant {
  key: ResumeVariantKey;
  sourceProfileVariant: ProfileVariantKey;
  label: string;
  headline: string;
  text: string;
  prioritizedKeywords: string[];
  deploymentWeight: number;
}

export interface BuildResumeVariantsInput {
  baseResume: ResumeArtifact;
  nicheResumes: ResumeArtifact[];
  profileVariants: Record<ProfileVariantKey, {
    key: string;
    optimizedHeadline: string;
    summary: string;
    prioritizedKeywords: string[];
    deploymentWeight: number;
  }>;
}

function pickNiche(niches: ResumeArtifact[], key: string, fallback: ResumeArtifact): ResumeArtifact {
  return niches.find((item) => item.key === key) || fallback;
}

function assemble(textBlocks: string[]): string {
  return textBlocks.filter(Boolean).join("\n\n");
}

export function buildResumeVariants(input: BuildResumeVariantsInput): Record<ResumeVariantKey, ResumeVariant> {
  const base = input.baseResume;
  const finance = pickNiche(input.nicheResumes, "finance_operations", base);
  const sales = pickNiche(input.nicheResumes, "lead_management_operations", base);
  const tender = pickNiche(input.nicheResumes, "tender_documentation", base);

  return {
    indeed_resume: {
      key: "indeed_resume",
      sourceProfileVariant: "indeed_profile",
      label: "Indeed ATS Resume",
      headline: input.profileVariants.indeed_profile.optimizedHeadline,
      text: assemble([input.profileVariants.indeed_profile.summary, base.text]),
      prioritizedKeywords: input.profileVariants.indeed_profile.prioritizedKeywords,
      deploymentWeight: input.profileVariants.indeed_profile.deploymentWeight,
    },
    linkedin_resume: {
      key: "linkedin_resume",
      sourceProfileVariant: "linkedin_profile",
      label: "LinkedIn Authority Resume",
      headline: input.profileVariants.linkedin_profile.optimizedHeadline,
      text: assemble([input.profileVariants.linkedin_profile.summary, sales.text]),
      prioritizedKeywords: input.profileVariants.linkedin_profile.prioritizedKeywords,
      deploymentWeight: input.profileVariants.linkedin_profile.deploymentWeight,
    },
    flexjobs_resume: {
      key: "flexjobs_resume",
      sourceProfileVariant: "flexjobs_profile",
      label: "FlexJobs Remote Resume",
      headline: input.profileVariants.flexjobs_profile.optimizedHeadline,
      text: assemble([input.profileVariants.flexjobs_profile.summary, base.text]),
      prioritizedKeywords: input.profileVariants.flexjobs_profile.prioritizedKeywords,
      deploymentWeight: input.profileVariants.flexjobs_profile.deploymentWeight,
    },
    tender_resume: {
      key: "tender_resume",
      sourceProfileVariant: "tender_profile",
      label: "Tender Compliance Resume",
      headline: input.profileVariants.tender_profile.optimizedHeadline,
      text: assemble([input.profileVariants.tender_profile.summary, tender.text]),
      prioritizedKeywords: input.profileVariants.tender_profile.prioritizedKeywords,
      deploymentWeight: input.profileVariants.tender_profile.deploymentWeight,
    },
    freelance_resume: {
      key: "freelance_resume",
      sourceProfileVariant: "freelance_profile",
      label: "Freelance Conversion Resume",
      headline: input.profileVariants.freelance_profile.optimizedHeadline,
      text: assemble([input.profileVariants.freelance_profile.summary, sales.text]),
      prioritizedKeywords: input.profileVariants.freelance_profile.prioritizedKeywords,
      deploymentWeight: input.profileVariants.freelance_profile.deploymentWeight,
    },
    corporate_operations_resume: {
      key: "corporate_operations_resume",
      sourceProfileVariant: "finance_profile",
      label: "Corporate Operations Resume",
      headline: input.profileVariants.finance_profile.optimizedHeadline,
      text: assemble([input.profileVariants.finance_profile.summary, finance.text]),
      prioritizedKeywords: input.profileVariants.finance_profile.prioritizedKeywords,
      deploymentWeight: input.profileVariants.finance_profile.deploymentWeight,
    },
  };
}
