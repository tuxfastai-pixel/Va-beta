import { Worker } from "bullmq";
import { config as loadEnv } from "dotenv";
import { resumeAgent } from "../lib/agents/resumeAgent.ts";
import { learningAgent } from "../lib/agents/learningAgent.ts";

loadEnv({ path: ".env.local" });

const tasksWorker = new Worker(
  "ranking-tasks",
  async (job) => {
    if (job.name === "rank") {
      return { userId: job.data.userId, status: "queued-for-ranking" };
    }

    if (job.name === "analyzeResume") {
      return resumeAgent(job.data.resume || "");
    }

    if (job.name === "skillGapAnalysis") {
      return learningAgent(job.data.profile || "");
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

tasksWorker.on("completed", (job) => {
  console.log(`Task worker job ${job.id} completed`);
});

tasksWorker.on("failed", (job, err) => {
  console.error(`Task worker job ${job?.id} failed`, err);
});

console.log("Tasks worker running...");
