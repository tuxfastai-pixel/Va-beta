import Redis from "ioredis";

const redis = new Redis();

export async function cacheJobs(jobs: unknown[]) {
  await redis.set(
    "global_jobs",
    JSON.stringify(jobs),
    "EX",
    3600
  );
}

export async function getCachedJobs(): Promise<unknown[] | null> {
  const data = await redis.get("global_jobs");

  return data ? (JSON.parse(data) as unknown[]) : null;
}
