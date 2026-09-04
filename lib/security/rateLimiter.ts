import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export interface RateLimitConfig {
  /** Requests allowed per window */
  limit: number;
  /** Window in seconds */
  windowSeconds: number;
  /** e.g. "api:orchestrator" – prefix for bucket key */
  namespace: string;
}

const DEFAULTS: RateLimitConfig = {
  limit: 60,
  windowSeconds: 60,
  namespace: "api",
};

/** Derive a stable bucket key from request */
function bucketKey(req: NextRequest, namespace: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `${namespace}:ip:${ip}`;
}

/**
 * Increment counter in DB and return whether request is within limit.
 * Falls back to allowing the request on DB errors so infra issues never
 * block legitimate traffic.
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + config.windowSeconds * 1000);

  try {
    // Atomic upsert with window rotation
    const { data: existing } = await supabaseServer
      .from("rate_limit_buckets")
      .select("id, count, window_end")
      .eq("key", key)
      .single();

    if (!existing) {
      // First request in this window
      await supabaseServer.from("rate_limit_buckets").insert({
        key,
        count: 1,
        window_end: windowEnd.toISOString(),
        updated_at: now.toISOString(),
      });
      return { allowed: true, remaining: config.limit - 1, resetAt: windowEnd };
    }

    const currentWindowEnd = new Date(existing.window_end as string);

    if (now > currentWindowEnd) {
      // Window expired — reset counter
      await supabaseServer
        .from("rate_limit_buckets")
        .update({ count: 1, window_end: windowEnd.toISOString(), updated_at: now.toISOString() })
        .eq("key", key);
      return { allowed: true, remaining: config.limit - 1, resetAt: windowEnd };
    }

    const count = (existing.count as number) + 1;
    if (count > config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: currentWindowEnd,
      };
    }

    await supabaseServer
      .from("rate_limit_buckets")
      .update({ count, updated_at: now.toISOString() })
      .eq("key", key);

    return { allowed: true, remaining: config.limit - count, resetAt: currentWindowEnd };
  } catch {
    // Fail open on DB errors
    return { allowed: true, remaining: config.limit, resetAt: windowEnd };
  }
}

/**
 * Apply rate limiting to a Next.js API route handler.
 *
 * Usage:
 *   export const POST = withRateLimit(handler, { limit: 10, windowSeconds: 60 });
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: Partial<RateLimitConfig> = {}
) {
  const cfg = { ...DEFAULTS, ...config };

  return async (req: NextRequest): Promise<NextResponse> => {
    const key = bucketKey(req, cfg.namespace);
    const { allowed, remaining, resetAt } = await checkRateLimit(key, cfg);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000) },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit":     String(cfg.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset":     String(Math.floor(resetAt.getTime() / 1000)),
            "Retry-After":           String(Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = await handler(req);

    response.headers.set("X-RateLimit-Limit",     String(cfg.limit));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset",     String(Math.floor(resetAt.getTime() / 1000)));

    return response;
  };
}

/**
 * Bearer token validation helper.
 * Returns 401 if token is missing or wrong.
 */
export function requireBearerToken(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const expected = process.env.CRON_SECRET;

  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * CSRF origin check for mutation routes (POST/PUT/PATCH/DELETE).
 * Only enforced in production.
 */
export function requireSameOrigin(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return null;

  const origin = req.headers.get("origin") ?? "";
  const host = req.headers.get("host") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${host}`;

  try {
    const originHost = new URL(origin).host;
    const appHost = new URL(appUrl).host;
    if (originHost !== appHost) {
      return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  return null;
}
