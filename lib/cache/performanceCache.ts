import Redis from "ioredis";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

let redis: Redis | null = null;

function getRedis() {
  if (redis) {
    return redis;
  }

  const host = process.env.REDIS_HOST;

  if (!host) {
    return null;
  }

  redis = new Redis({
    host,
    port: Number(process.env.REDIS_PORT ?? 6379),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redis.on("error", () => {
    // Fallback to in-memory cache when Redis is unavailable.
  });

  return redis;
}

function getMemory(key: string) {
  const entry = memoryStore.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return entry.value;
}

function setMemory(key: string, value: string, ttlSeconds: number) {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function getCache<T>(key: string): Promise<T | null> {
  const redisClient = getRedis();

  if (redisClient) {
    try {
      if (redisClient.status === "wait") {
        await redisClient.connect();
      }

      const data = await redisClient.get(key);
      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch {
      const fallback = getMemory(key);
      return fallback ? (JSON.parse(fallback) as T) : null;
    }
  }

  const fallback = getMemory(key);
  return fallback ? (JSON.parse(fallback) as T) : null;
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number) {
  const serialized = JSON.stringify(value);
  const redisClient = getRedis();

  if (redisClient) {
    try {
      if (redisClient.status === "wait") {
        await redisClient.connect();
      }

      await redisClient.set(key, serialized, "EX", ttlSeconds);
      return;
    } catch {
      setMemory(key, serialized, ttlSeconds);
      return;
    }
  }

  setMemory(key, serialized, ttlSeconds);
}

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = await getCache<T>(key);

  if (cached !== null) {
    return cached;
  }

  const value = await loader();
  await setCache(key, value, ttlSeconds);
  return value;
}
