import { redis } from "@/lib/redis";

export async function cacheJobs(jobs: unknown[]) {
  if (!redis) return;
  await redis.set("global_jobs", JSON.stringify(jobs), { ex: 3600 });
}

export async function getCachedJobs(): Promise<unknown[] | null> {
  if (!redis) return null;
  const data = await redis.get<string>("global_jobs");
  return data ? (JSON.parse(data) as unknown[]) : null;
}
