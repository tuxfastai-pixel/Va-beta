import { Worker } from "bullmq";
import { config as loadEnv } from "dotenv";
import { jobHunterAgent } from "../lib/agents/jobHunterAgent.ts";
import { resumeAgent } from "../lib/agents/resumeAgent.ts";
import { learningAgent } from "../lib/agents/learningAgent.ts";
import { jobMatcherAgent } from "../lib/agents/jobMatcherAgent.ts";
import { autoApplicationAgent } from "../lib/agents/autoApplicationAgent.ts";

loadEnv({ path: ".env.local" });

const worker = new Worker(
  "career-tasks",
  async (job) => {
    switch (job.name) {
      case "scanJobs":
        return await jobHunterAgent(job.data.userId, job.data.resume, job.data.profile);

      case "analyzeResume":
        return await resumeAgent(job.data.resume);

      case "skillGapAnalysis":
        return await learningAgent(job.data.profile);

      case "matchJob":
        return await jobMatcherAgent(
          job.data.userId,
          job.data.resume,
          job.data.job,
          job.data.profile
        );

      case "autoApply":
        return await autoApplicationAgent(
          job.data.userId,
          job.data.job,
          job.data.resume,
          job.data.profile
        );
    }

    return null;
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
    concurrency: 5,
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log("AI agent worker running...");
