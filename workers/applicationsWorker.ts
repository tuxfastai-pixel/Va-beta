import { Worker } from "bullmq";
import { config as loadEnv } from "dotenv";
import { autoApplicationAgent } from "../lib/agents/autoApplicationAgent.ts";

loadEnv({ path: ".env.local" });

type ApplicationJobPayload = Record<string, unknown>;

async function applyForUser(userId: string, job: ApplicationJobPayload, resume: string, profile: string) {
  await autoApplicationAgent(userId, job, resume, profile);
}

const applicationWorker = new Worker(
  "application-tasks",
  async (job) => {
    const { userId, job: userJob, resume = "", profile = "" } = job.data;

    if (!userJob) {
      return { userId, status: "application-planned" };
    }

    await applyForUser(userId, userJob, resume, profile);
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
    concurrency: 10,
  }
);

applicationWorker.on("completed", (job) => {
  console.log(`Application job ${job.id} completed`);
});

applicationWorker.on("failed", (job, err) => {
  console.error(`Application job ${job?.id} failed`, err);
});

console.log("Applications worker running...");
