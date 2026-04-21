import { redis } from "@/lib/redis";

export async function hasUserSeenJob(userId: string, jobId: string) {
  if (!redis) return false;
  const key = `user_jobs:${userId}`;
  const members = await redis.smembers(key);
  return members.includes(jobId);
}

export async function markJobSeen(userId: string, jobId: string) {
  if (!redis) return;
  const key = `user_jobs:${userId}`;
  await redis.sadd(key, jobId);
  await redis.expire(key, 60 * 60 * 24 * 7);
}
