import type { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const queuesEnabled = process.env.ENABLE_QUEUES === "true";

if (!queuesEnabled) {
  console.log("🚫 Queues disabled");
}

export let discoveryQueue: Queue | null = null;

async function getDiscoveryQueue() {
  if (!queuesEnabled) {
    return null;
  }

  const redisHost = process.env.REDIS_HOST?.trim();
  const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

  if (!redisHost || redisHost === "127.0.0.1" || redisHost === "localhost") {
    return null;
  }

  if (!discoveryQueue) {
    const { Queue } = await import("bullmq");
    discoveryQueue = new Queue("discovery-tasks", {
      connection: {
        host: redisHost,
        ...(redisPort ? { port: redisPort } : {}),
      },
    });
  }

  return discoveryQueue;
}

export async function enqueueDiscovery(userId: string, markets: string[] = []) {
  const queue = await getDiscoveryQueue();

  if (!queue) {
    return null;
  }

  return queue.add("discover", {
    userId,
    markets,
  });
}
