import { Worker } from "bullmq";
import { config as loadEnv } from "dotenv";
import { discoverGlobalJobs } from "../lib/agents/globalDiscoveryAgent.ts";

loadEnv({ path: ".env.local" });

const redisHost = process.env.REDIS_HOST?.trim();

if (!redisHost || redisHost.includes("127.0.0.1") || redisHost.includes("localhost")) {
  console.log("⚠️  Redis disabled or localhost - discovery worker will not start");
} else {
  const discoveryWorker = new Worker(
    "discovery-tasks",
    async () => {
      return discoverGlobalJobs();
    },
    {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
      concurrency: 3,
    }
  );

  discoveryWorker.on("completed", (job) => {
    console.log(`Discovery job ${job.id} completed`);
  });

  discoveryWorker.on("failed", (job, err) => {
    console.error(`Discovery job ${job?.id} failed`, err);
  });

  console.log("Discovery worker running...");
}
