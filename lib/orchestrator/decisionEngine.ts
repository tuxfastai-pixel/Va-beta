import type { UserState } from "./stateManager";

type JobLike = {
  id?: string | number | null;
  title?: string | null;
  description?: string | null;
  skills?: string[] | string | null;
  budget?: number | string | null;
  pay_amount?: number | string | null;
  proposals?: number | null;
  proposal_count?: number | null;
  match_score?: number | null;
  quality_score?: number | null;
  scam_risk?: string | null;
};

type UserLike = {
  skills?: string[] | string | null;
  autoApplyEnabled?: boolean | null;
};

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[,|\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function extractJobSkills(job: JobLike) {
  const directSkills = normalizeList(job.skills);
  if (directSkills.length > 0) {
    return directSkills;
  }

  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  const keywords = [
    "admin",
    "assistant",
    "data entry",
    "crm",
    "lead generation",
    "research",
    "writing",
    "support",
    "bookkeeping",
  ];

  return keywords.filter((keyword) => text.includes(keyword));
}

export function isAIExecutable(job: JobLike) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  const aiFriendlyKeywords = [
    "admin",
    "assistant",
    "data entry",
    "crm",
    "research",
    "email",
    "calendar",
    "writing",
    "content",
    "report",
    "spreadsheet",
    "support",
  ];
  const humanOnlyKeywords = ["on-site", "onsite", "driver", "warehouse", "physical", "in-person"];

  if (humanOnlyKeywords.some((keyword) => text.includes(keyword))) {
    return false;
  }

  return aiFriendlyKeywords.some((keyword) => text.includes(keyword));
}

export function scoreJob(job: JobLike, user: UserLike) {
  const budget = Number(job.budget ?? job.pay_amount ?? 0);
  const proposals = Number(job.proposals ?? job.proposal_count ?? 0);

  if (proposals > 15) return 0;
  if (budget < 20) return 0;
  if (!isAIExecutable(job)) return 0;

  let score = 0;
  const userSkills = normalizeList(user.skills);
  const jobSkills = extractJobSkills(job);

  if (jobSkills.some((skill) => userSkills.includes(skill) || userSkills.some((userSkill) => userSkill.includes(skill) || skill.includes(userSkill)))) {
    score += 30;
  }

  if (budget > 100) score += 20;
  if (proposals < 10) score += 25;
  if (isAIExecutable(job)) score += 25;

  if ((job.match_score ?? 0) >= 70) score += 10;
  if (String(job.scam_risk || "low").toLowerCase() === "low") score += 10;

  return score;
}

export function rankJobsForUser<T extends JobLike>(jobs: T[], user: UserLike) {
  return jobs
    .map((job) => ({
      ...job,
      intelligent_score: scoreJob(job, user),
      win_label: scoreJob(job, user) >= 80 ? "High chance to win" : scoreJob(job, user) >= 55 ? "Worth applying" : "Lower priority",
    }))
    .sort((a, b) => b.intelligent_score - a.intelligent_score);
}

export function decideNextAction(state: UserState, user?: UserLike) {
  switch (state) {
    case "onboarding":
      return "complete_platforms";
    case "ready":
      return "build_profile";
    case "hunting":
      return "find_jobs";
    case "applying":
      return user?.autoApplyEnabled === false ? "manual_review_required" : "send_proposals";
    case "conversing":
      return "reply_to_clients";
    case "working":
      return "execute_tasks";
    case "earning":
      return "optimize_earnings";
    default:
      return "idle";
  }
}
