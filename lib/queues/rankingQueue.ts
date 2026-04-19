import { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

export const rankingQueue = new Queue("ranking-tasks", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
});

export async function enqueueRanking(userId: string) {
  return rankingQueue.add("rank", {
    userId,
  });
}
