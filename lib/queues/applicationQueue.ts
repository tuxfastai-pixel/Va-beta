import type { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const queuesEnabled = process.env.ENABLE_QUEUES === "true";

if (!queuesEnabled) {
  console.log("🚫 Queues disabled");
}

export let applicationQueue: Queue | null = null;

async function getApplicationQueue() {
  if (!queuesEnabled) {
    return null;
  }

  const redisHost = process.env.REDIS_HOST?.trim();
  const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

  if (!redisHost || redisHost === "127.0.0.1" || redisHost === "localhost") {
    return null;
  }

  if (!applicationQueue) {
    const { Queue } = await import("bullmq");
    applicationQueue = new Queue("application-tasks", {
      connection: {
        host: redisHost,
        ...(redisPort ? { port: redisPort } : {}),
      },
    });
  }

  return applicationQueue;
}

export async function enqueueApplications(userId: string) {
  const queue = await getApplicationQueue();

  if (!queue) {
    return null;
  }

  return queue.add("apply", {
    userId,
  });
}

type ApplicationJobPayload = {
  userId: string;
  job: Record<string, unknown>;
  resume?: string;
  profile?: string;
};

export async function enqueueApplicationJob(payload: ApplicationJobPayload) {
  const queue = await getApplicationQueue();

  if (!queue) {
    return null;
  }

  await queue.add("applyForUser", payload);
}
