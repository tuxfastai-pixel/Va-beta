import { redis } from "@/lib/redis";

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

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
  if (redis) {
    try {
      const data = await redis.get<string>(key);
      if (data) return JSON.parse(data) as T;
    } catch {
      // fall through to in-memory
    }
  }
  const fallback = getMemory(key);
  return fallback ? (JSON.parse(fallback) as T) : null;
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number) {
  const serialized = JSON.stringify(value);
  if (redis) {
    try {
      await redis.set(key, serialized, { ex: ttlSeconds });
      return;
    } catch {
      // fall through to in-memory
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
