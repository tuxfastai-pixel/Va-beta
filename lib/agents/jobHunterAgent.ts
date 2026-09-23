import { config as loadEnv } from "dotenv";
import { hasUserSeenJob, markJobSeen } from "../cache/userJobDelta.ts";
import { scoreJob } from "@/lib/orchestrator/decisionEngine";
import { scoreJob as scoreJobLite } from "@/lib/ai/jobScorer";
import { getPlatformWeight } from "@/lib/platforms/platformRegistry";
import { fetchFlexJobs } from "@/lib/agents/flexjobsAgent";
import type { AgentResult } from "./agentTypes";
import { filterJob, saveQuality, type JobCandidate } from "./jobQualityFilter.ts";

loadEnv({ path: ".env.local" });

const queuesEnabled = process.env.ENABLE_QUEUES === "true";

if (!queuesEnabled) {
  console.log("🚫 Queues disabled");
}

type LightweightQueue = {
  add: (name: string, data: Record<string, unknown>) => Promise<unknown>;
};

let jobQueue: LightweightQueue | null = null;

async function getJobQueue() {
  if (!queuesEnabled) {
    return null;
  }

  if (jobQueue) {
    return jobQueue;
  }

  const redisHost = process.env.REDIS_HOST?.trim();
  const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

  if (!redisHost || redisHost === "127.0.0.1" || redisHost === "localhost") {
    return null;
  }

  const { Queue } = await import("bullmq");
  jobQueue = new Queue("career-tasks", {
    connection: {
      host: redisHost,
      ...(redisPort ? { port: redisPort } : {}),
    },
  }) as LightweightQueue;

  return jobQueue;
}

type JobHunterUser = {
  id?: string;
  user_id?: string;
  resume?: string | null;
  profile?: string | null;
  skills?: string[] | string | null;
  careerFocus?: string | null;
  jobLimit?: number | null;
};

function normalizeUser(user: JobHunterUser | string, resume = "", profile = ""): Required<Pick<JobHunterUser, "user_id" | "resume" | "profile">> & JobHunterUser {
  if (typeof user === "string") {
    return {
      user_id: user,
      resume,
      profile,
      skills: [resume, profile].filter(Boolean).join(", "),
    };
  }

  return {
    ...user,
    user_id: String(user.user_id || user.id || "").trim(),
    resume: String(user.resume || ""),
    profile: String(user.profile || ""),
  };
}

const careerAliases: Record<string, string[]> = {
  teacher: ["teacher", "teaching", "tutor", "education", "lesson"],
  admin: ["admin", "assistant", "virtual assistant", "operations"],
  writer: ["writer", "writing", "content", "copywriter"],
  customer_support: ["customer support", "support", "helpdesk"],
  data_entry: ["data entry", "spreadsheet", "excel", "data"],
};

function matchesCareer(job: JobCandidate, careerFocus?: string | null) {
  const career = String(careerFocus || "").toLowerCase();
  if (!career) {
    return true;
  }

  const aliases = careerAliases[career] || [career];
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  return aliases.some((alias) => text.includes(alias));
}

async function aggregateJobsFromPlatforms(careerFocus: string) {
  const [remotiveData, flexData] = await Promise.all([
    fetch("https://remotive.com/api/remote-jobs")
      .then(async (response) => {
        const payload = (await response.json()) as { jobs?: JobCandidate[] };
        return Array.isArray(payload.jobs) ? payload.jobs : [];
      })
      .catch(() => [] as JobCandidate[]),
    fetchFlexJobs(careerFocus),
  ]);

  return [
    ...remotiveData.slice(0, 50).map((job) => ({ ...job, platform: "indeed", remote: true })),
    ...flexData.slice(0, 30).map((job) => ({ ...job, platform: "flexjobs" })),
  ] as Array<JobCandidate & { platform?: string; remote?: boolean; type?: string }>;
}

export async function jobHunterAgent(user: JobHunterUser | string, resume = "", profile = ""): Promise<AgentResult<JobCandidate[]>> {
  const queue = await getJobQueue();
  const normalizedUser = normalizeUser(user, resume, profile);

  const normalizedLimit = Number(normalizedUser.jobLimit || 25);
  const maxJobs = Number.isFinite(normalizedLimit) ? Math.max(1, Math.min(50, normalizedLimit)) : 25;
  const jobs = await aggregateJobsFromPlatforms(String(normalizedUser.careerFocus || "virtual assistant"));

  const validJobs: Array<JobCandidate & { platform?: string; score: number; intelligent_score: number; win_label: string }> = [];

  for (const job of jobs) {
    if (!matchesCareer(job, normalizedUser.careerFocus)) {
      continue;
    }

    const quality = await filterJob(job);
    const jobId = String(job.id ?? job.url ?? "");

    await saveQuality(jobId, quality);

    if (quality.quality_score < 60 || quality.scam_risk >= 0.6) {
      continue;
    }

    const intelligentScore = scoreJob(
      {
        title: job.title,
        description: job.description,
        pay_amount: typeof job.salary === "number" ? job.salary : undefined,
        budget: typeof job.salary === "number" ? job.salary : undefined,
        skills: Array.isArray((job as { tags?: unknown }).tags) ? ((job as { tags?: string[] }).tags || []) : [],
        proposals: 0,
        scam_risk: quality.scam_risk < 0.3 ? "low" : "medium",
        platform: String((job as { platform?: string }).platform || "indeed"),
        platformWeight: getPlatformWeight(String((job as { platform?: string }).platform || "indeed")),
        remote: Boolean((job as { remote?: boolean }).remote ?? true),
        type: String((job as { type?: string }).type || "long_term"),
      },
      { skills: normalizedUser.skills || [normalizedUser.resume, normalizedUser.profile].filter(Boolean).join(", ") }
    );

    const score = scoreJobLite({
      title: job.title,
      description: job.description,
      budget: typeof job.salary === "number" ? job.salary : Number((job as { pay_amount?: unknown }).pay_amount || 0),
      platform: String((job as { platform?: string }).platform || "indeed"),
      platformWeight: getPlatformWeight(String((job as { platform?: string }).platform || "indeed")),
      remote: Boolean((job as { remote?: boolean }).remote ?? true),
      type: String((job as { type?: string }).type || "long_term"),
    });

    validJobs.push({
      ...job,
      score,
      intelligent_score: intelligentScore,
      win_label: intelligentScore >= 80 ? "High chance to win" : intelligentScore >= 55 ? "Worth applying" : "Lower priority",
    });

    if (!jobId || !normalizedUser.user_id) {
      continue;
    }

    if (!(await hasUserSeenJob(normalizedUser.user_id, jobId))) {
      if (queue) {
        await queue.add("matchJob", {
          userId: normalizedUser.user_id,
          resume: normalizedUser.resume,
          profile: normalizedUser.profile,
          job,
        });
      }

      await markJobSeen(normalizedUser.user_id, jobId);
    }
  }

  const ranked = validJobs
    .sort((a, b) => (b.intelligent_score + b.score * 10) - (a.intelligent_score + a.score * 10))
    .slice(0, maxJobs);

  return {
    success: true,
    data: ranked,
    confidence: ranked.length > 0 ? 0.9 : 0.5,
    feedback: ranked.length > 0 ? "Top jobs ranked by likelihood to win." : "No high-confidence jobs found in this cycle.",
  };
}
