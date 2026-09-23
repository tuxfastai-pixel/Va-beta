import { confidenceScore, humanize, proposalTemplate, validateOutput, varySentence } from "@/lib/ai/outputQuality";
import { detectCareerFromJob } from "@/lib/ai/careerDetector";
import { buildPricingSection } from "@/lib/ai/pricingStrategy";
import { addUrgencyPersonalization, applyPsychology } from "@/lib/psychology/conversionPsychology";
import { generatePlatformResponse } from "@/lib/ai/platformResponder";

export type ProposalTone = "professional" | "friendly" | "assertive";

type ProposalJob = {
  id?: string | number | null;
  title?: string | null;
  description?: string | null;
  company?: string | null;
  budget?: number | string | null;
  pay_amount?: number | string | null;
  skills?: string[] | string | null;
  proposals?: number | null;
  proposal_count?: number | null;
};

type ProposalUser = {
  name?: string | null;
  skills?: string[] | string | null;
};

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function varyTone(type: ProposalTone) {
  const tones: Record<ProposalTone, string> = {
    professional: "I focus on structured delivery, clear updates, and a dependable result with clear value.",
    friendly: "I’d be glad to make this easy for you and keep communication simple throughout.",
    assertive: "I can start immediately, move fast, and deliver a reliable result without unnecessary back-and-forth.",
  };

  return tones[type];
}

export function suggestProposalTone(job: ProposalJob): ProposalTone {
  const proposals = Number(job.proposals ?? job.proposal_count ?? 0);
  const budget = Number(job.pay_amount ?? job.budget ?? 0);

  if (proposals > 20) {
    return "assertive";
  }

  if (budget > 500) {
    return "professional";
  }

  return "friendly";
}

export function generateSolution(job: ProposalJob) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  const steps: string[] = [];

  if (text.includes("data") || text.includes("spreadsheet") || text.includes("excel")) {
    steps.push("- organize and clean the data for accuracy and easy handover");
  }

  if (text.includes("admin") || text.includes("assistant") || text.includes("calendar") || text.includes("email")) {
    steps.push("- handle the admin workflow efficiently with clear status updates");
  }

  if (text.includes("crm") || text.includes("lead") || text.includes("client")) {
    steps.push("- update records, follow process steps, and keep client-facing work consistent");
  }

  if (text.includes("research") || text.includes("writing") || text.includes("content")) {
    steps.push("- use fast research and drafting workflows to save time while maintaining quality");
  }

  if (steps.length === 0) {
    steps.push("- review your requirements quickly and set up the most efficient workflow");
    steps.push("- deliver the work with accuracy, speed, and clear communication");
  }

  return steps.join("\n");
}

export function highConversionProposal(job: ProposalJob, user: ProposalUser = {}, tone?: ProposalTone) {
  const selectedTone = tone ?? suggestProposalTone(job);
  const skillText = normalizeList(user.skills).slice(0, 3).join(", ") || "admin support and digital execution";
  const rateHint = Number(job.pay_amount ?? job.budget ?? 0);

  return proposalTemplate({
    summary: `${job.title || "this project"} for ${job.company || "your team"}`,
    solution: [
      varySentence("Hi,"),
      "",
      "I saw your project and it’s something I can help with.",
      `You need: ${job.title || "clear support on this task"}`,
      "",
      "Here’s what I’ll do:",
      generateSolution(job),
      "",
      `I work efficiently using structured workflows and modern tools in ${skillText}, so you’ll get fast and accurate results.`,
      varyTone(selectedTone),
      "",
      "Happy to get started right away — let me know 👍",
    ].join("\n"),
    timeline: "Immediate start with clear milestones and regular updates.",
    rate: rateHint > 0 ? `Aligned to a budget around $${rateHint}` : "Flexible based on scope",
  });
}

export function eliteProposal(job: ProposalJob, user: ProposalUser = {}, tone?: ProposalTone) {
  const selectedTone = tone ?? suggestProposalTone(job);
  const skillText = normalizeList(user.skills).slice(0, 3).join(", ") || "admin support and digital execution";

  const structured = [
    "Hi,",
    "",
    "This stood out - I can help quickly.",
    "",
    `You need ${job.title || "this task"} done with clear execution and no unnecessary delay.`,
    "",
    "Here’s exactly how I’ll do it:",
    generateSolution(job),
    "",
    `I’ll keep communication simple, move fast, and deliver reliable results using practical workflows in ${skillText}.`,
    varyTone(selectedTone),
    "",
    "Happy to start immediately 👍",
  ].join("\n");

  return addUrgencyPersonalization(String(job.title || ""), structured);
}

export async function generateWinningProposal(job: ProposalJob, user: ProposalUser = {}, tone?: ProposalTone) {
  let proposal = humanize(applyPsychology(eliteProposal(job, user, tone)));
  const validation = await validateOutput(proposal);

  if (confidenceScore(proposal) < 80 || !validation.passed) {
    proposal = humanize(`${proposal}\n\nClear value: fast execution, strong communication, and reliable delivery for you.`);
  }

  return proposal;
}

function buildTeachingProposal(job: ProposalJob) {
  return `I can support this teaching project with clear lesson flow, practical examples, and consistent communication tailored to learner outcomes for ${job.title || "this role"}.`;
}

function buildAdminProposal(job: ProposalJob) {
  return `I can support this admin project with organized execution, reliable updates, and efficient handling of tasks for ${job.title || "this role"}.`;
}

function buildGeneralProposal(job: ProposalJob) {
  return `I can support this project with efficient workflows, strong communication, and reliable delivery for ${job.title || "this role"}.`;
}

export function generateProposal(
  job: ProposalJob,
  profile: { careers?: string[]; primary_career?: string | null },
  options?: { price?: { recommended: number; anchor: number }; strategy?: string }
) {
  const careers = Array.isArray(profile.careers) && profile.careers.length > 0
    ? profile.careers
    : [String(profile.primary_career || "general")];

  const matchedCareer = detectCareerFromJob(job, careers);
  let content = "";

  switch (matchedCareer) {
    case "teacher":
      content = buildTeachingProposal(job);
      break;
    case "admin":
      content = buildAdminProposal(job);
      break;
    default:
      content = buildGeneralProposal(job);
      break;
  }

  if (options?.price && options?.strategy) {
    content = `${content}\n\n${buildPricingSection(options.price, options.strategy)}`;
  }

  const platformResponse = generatePlatformResponse(String((job as { platform?: unknown }).platform || ""), {
    title: job.title,
    company: job.company,
  });

  content = `${platformResponse}\n\n${content}\n\nWould you like me to begin with the first priority step?`;

  return content;
}
