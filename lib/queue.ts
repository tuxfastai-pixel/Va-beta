import { Queue } from "bullmq";

if (!process.env.UPSTASH_REDIS_REST_URL) {
  console.log("⚠️ Redis not configured — agentQueue disabled");
}

export const agentQueue = process.env.REDIS_HOST
  ? new Queue("agentTasks", {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    })
  : null;

