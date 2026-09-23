import type { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const queuesEnabled = process.env.ENABLE_QUEUES === "true";

if (!queuesEnabled) {
  console.log("🚫 Queues disabled");
}

type WakePayload = {
  taskId: string;
  taskType: string;
};

let wakeQueue: Queue<WakePayload> | null = null;

async function getWakeQueue() {
  if (!queuesEnabled) {
    return null;
  }

  const host = process.env.REDIS_HOST?.trim();
  const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

  if (!host || host === "127.0.0.1" || host === "localhost") {
    return null;
  }

  if (!wakeQueue) {
    const { Queue } = await import("bullmq");
    wakeQueue = new Queue<WakePayload>("ai-worker-wakeup", {
      connection: {
        host,
        ...(port ? { port } : {}),
      },
    });
  }

  return wakeQueue;
}

export async function notifyAiWorkerWake(payload: WakePayload) {
  const queue = await getWakeQueue();

  if (!queue) {
    return false;
  }

  try {
    await queue.add("wake", payload, {
      removeOnComplete: true,
      removeOnFail: true,
    });

    return true;
  } catch {
    return false;
  }
}
