import { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

export const applicationQueue = new Queue("application-tasks", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
});

export async function enqueueApplications(userId: string) {
  return applicationQueue.add("apply", {
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
  await applicationQueue.add("applyForUser", payload);
}
