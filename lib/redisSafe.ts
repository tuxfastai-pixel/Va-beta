import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

try {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redis = new Redis({
      url,
      token,
    });
  } else {
    console.log("Redis is not configured");
  }
} catch (error: unknown) {
  console.log("Redis is disabled:", error);
}

export { redis };
