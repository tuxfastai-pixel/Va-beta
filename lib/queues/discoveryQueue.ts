import { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

export const discoveryQueue = new Queue("discovery-tasks", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
});

export async function enqueueDiscovery(userId: string, markets: string[] = []) {
  return discoveryQueue.add("discover", {
    userId,
    markets,
  });
}
