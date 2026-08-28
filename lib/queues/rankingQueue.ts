import type { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const queuesEnabled = process.env.ENABLE_QUEUES === "true";

if (!queuesEnabled) {
  console.log("🚫 Queues disabled");
}

export let rankingQueue: Queue | null = null;

async function getRankingQueue() {
  if (!queuesEnabled) {
    return null;
  }

  const redisHost = process.env.REDIS_HOST?.trim();
  const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

  if (!redisHost || redisHost === "127.0.0.1" || redisHost === "localhost") {
    return null;
  }

  if (!rankingQueue) {
    const { Queue } = await import("bullmq");
    rankingQueue = new Queue("ranking-tasks", {
      connection: {
        host: redisHost,
        ...(redisPort ? { port: redisPort } : {}),
      },
    });
  }

  return rankingQueue;
}

export async function enqueueRanking(userId: string) {
  const queue = await getRankingQueue();

  if (!queue) {
    return null;
  }

  return queue.add("rank", {
    userId,
  });
}
