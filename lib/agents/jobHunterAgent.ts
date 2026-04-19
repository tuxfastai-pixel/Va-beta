import { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";
import { hasUserSeenJob, markJobSeen } from "../cache/userJobDelta.ts";
import { scoreJob } from "@/lib/orchestrator/decisionEngine";
import type { AgentResult } from "./agentTypes";
import { filterJob, saveQuality, type JobCandidate } from "./jobQualityFilter.ts";

loadEnv({ path: ".env.local" });

const jobQueue = new Queue("career-tasks", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
});

type JobHunterUser = {
  id?: string;
  user_id?: string;
  resume?: string | null;
  profile?: string | null;
  skills?: string[] | string | null;
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

export async function jobHunterAgent(user: JobHunterUser | string, resume = "", profile = ""): Promise<AgentResult<JobCandidate[]>> {
  const normalizedUser = normalizeUser(user, resume, profile);
  const response = await fetch("https://remotive.com/api/remote-jobs");
  const data = (await response.json()) as { jobs?: JobCandidate[] };

  const jobs = Array.isArray(data.jobs) ? data.jobs.slice(0, 25) : [];
  const validJobs: Array<JobCandidate & { intelligent_score: number; win_label: string }> = [];

  for (const job of jobs) {
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
        skills: Array.isArray((job as { tags?: unknown }).tags) ? ((job as { tags?: string[] }).tags || []) : [],
        proposals: 0,
        scam_risk: quality.scam_risk < 0.3 ? "low" : "medium",
      },
      { skills: normalizedUser.skills || [normalizedUser.resume, normalizedUser.profile].filter(Boolean).join(", ") }
    );

    validJobs.push({
      ...job,
      intelligent_score: intelligentScore,
      win_label: intelligentScore >= 80 ? "High chance to win" : intelligentScore >= 55 ? "Worth applying" : "Lower priority",
    });

    if (!jobId || !normalizedUser.user_id) {
      continue;
    }

    if (!(await hasUserSeenJob(normalizedUser.user_id, jobId))) {
      await jobQueue.add("matchJob", {
        userId: normalizedUser.user_id,
        resume: normalizedUser.resume,
        profile: normalizedUser.profile,
        job,
      });

      await markJobSeen(normalizedUser.user_id, jobId);
    }
  }

  const ranked = validJobs.sort((a, b) => b.intelligent_score - a.intelligent_score).slice(0, 5);

  return {
    success: true,
    data: ranked,
    confidence: ranked.length > 0 ? 0.9 : 0.5,
    feedback: ranked.length > 0 ? "Top jobs ranked by likelihood to win." : "No high-confidence jobs found in this cycle.",
  };
}
