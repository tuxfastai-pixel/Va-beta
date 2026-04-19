import Redis from "ioredis";

const redis = new Redis();

export async function hasUserSeenJob(userId: string, jobId: string) {
  const key = `user_jobs:${userId}`;
  return await redis.sismember(key, jobId);
}

export async function markJobSeen(userId: string, jobId: string) {
  const key = `user_jobs:${userId}`;
  await redis.sadd(key, jobId);
  await redis.expire(key, 60 * 60 * 24 * 7);
}
