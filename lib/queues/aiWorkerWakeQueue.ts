import { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

type WakePayload = {
  taskId: string;
  taskType: string;
};

let wakeQueue: Queue<WakePayload> | null = null;

function getWakeQueue() {
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT ?? 6379);

  if (!host) {
    return null;
  }

  if (!wakeQueue) {
    wakeQueue = new Queue<WakePayload>("ai-worker-wakeup", {
      connection: {
        host,
        port,
      },
    });
  }

  return wakeQueue;
}

export async function notifyAiWorkerWake(payload: WakePayload) {
  const queue = getWakeQueue();

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
