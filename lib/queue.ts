import type { Queue } from "bullmq";

const queuesEnabled = process.env.ENABLE_QUEUES === "true";

if (!queuesEnabled) {
  console.log("🚫 Queues disabled");
}

export let agentQueue: Queue | null = null;

export async function getAgentQueue() {
  if (!queuesEnabled) {
    return null;
  }

  const redisHost = process.env.REDIS_HOST?.trim();
  const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

  if (!redisHost || redisHost === "127.0.0.1" || redisHost === "localhost") {
    return null;
  }

  if (!agentQueue) {
    const { Queue } = await import("bullmq");
    agentQueue = new Queue("agentTasks", {
      connection: {
        host: redisHost,
        ...(redisPort ? { port: redisPort } : {}),
      },
    });
  }

  return agentQueue;
}

