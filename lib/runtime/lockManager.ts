import { supabaseServer } from "@/lib/supabaseServer";

export interface LockAcquireOptions {
  leaseSeconds?: number;
  retryWindowMs?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

export interface LockState {
  taskId: string;
  ownerId: string;
  leaseExpiresAt: string;
  acquired: boolean;
  attempts: number;
}

function nowMs(): number {
  return Date.now();
}

function toIso(msFromNow: number): string {
  return new Date(nowMs() + msFromNow).toISOString();
}

async function tryClaim(taskId: string, orchestratorId: string, leaseSeconds: number, metadata?: Record<string, unknown>): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const leaseExpiresAt = toIso(leaseSeconds * 1000);

  // 1) No lock exists yet.
  const insertResult = await supabaseServer.from("runtime_locks").insert({
    task_id: taskId,
    owner_id: orchestratorId,
    lease_expires_at: leaseExpiresAt,
    metadata: metadata ?? {},
  });
  if (!insertResult.error) return true;

  // 2) Lock already owned by this orchestrator -> renew ownership.
  const selfRenew = await supabaseServer
    .from("runtime_locks")
    .update({ lease_expires_at: leaseExpiresAt, updated_at: nowIso, metadata: metadata ?? {} })
    .eq("task_id", taskId)
    .eq("owner_id", orchestratorId)
    .select("id")
    .limit(1);
  if (!selfRenew.error && (selfRenew.data?.length ?? 0) > 0) return true;

  // 3) Existing lease expired -> steal lock.
  const expiredTakeover = await supabaseServer
    .from("runtime_locks")
    .update({ owner_id: orchestratorId, lease_expires_at: leaseExpiresAt, updated_at: nowIso, metadata: metadata ?? {} })
    .eq("task_id", taskId)
    .lte("lease_expires_at", nowIso)
    .select("id")
    .limit(1);

  return !expiredTakeover.error && (expiredTakeover.data?.length ?? 0) > 0;
}

export async function acquireLock(taskId: string, orchestratorId: string, options?: LockAcquireOptions): Promise<LockState> {
  const leaseSeconds = Math.max(15, Number(options?.leaseSeconds ?? 120));
  const retryWindowMs = Math.max(0, Number(options?.retryWindowMs ?? 800));
  const maxRetries = Math.max(0, Number(options?.maxRetries ?? 2));

  let attempts = 0;

  while (attempts <= maxRetries) {
    attempts += 1;

    const acquired = await tryClaim(taskId, orchestratorId, leaseSeconds, options?.metadata);
    if (acquired) {
      return {
        taskId,
        ownerId: orchestratorId,
        leaseExpiresAt: toIso(leaseSeconds * 1000),
        acquired: true,
        attempts,
      };
    }

    if (attempts <= maxRetries && retryWindowMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryWindowMs));
    }
  }

  return {
    taskId,
    ownerId: orchestratorId,
    leaseExpiresAt: new Date().toISOString(),
    acquired: false,
    attempts,
  };
}

export async function renewLease(taskId: string, orchestratorId: string, leaseSeconds = 120): Promise<boolean> {
  const leaseExpiresAt = toIso(Math.max(15, leaseSeconds) * 1000);

  const { data, error } = await supabaseServer
    .from("runtime_locks")
    .update({ lease_expires_at: leaseExpiresAt, updated_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("owner_id", orchestratorId)
    .select("id")
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

export async function releaseLock(taskId: string, orchestratorId?: string): Promise<boolean> {
  const query = supabaseServer.from("runtime_locks").delete().eq("task_id", taskId);
  const { error } = orchestratorId ? await query.eq("owner_id", orchestratorId) : await query;
  return !error;
}

export async function withLock<T>(
  taskId: string,
  orchestratorId: string,
  fn: () => Promise<T>,
  options?: LockAcquireOptions
): Promise<{ acquired: boolean; result: T | null }> {
  const lock = await acquireLock(taskId, orchestratorId, options);
  if (!lock.acquired) {
    return { acquired: false, result: null };
  }

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    await releaseLock(taskId, orchestratorId);
  }
}
