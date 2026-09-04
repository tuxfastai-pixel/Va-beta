import { supabaseServer } from "@/lib/supabaseServer";
import { acquireLock, releaseLock } from "@/lib/runtime/lockManager";

export interface ReservationOptions {
  timeoutSeconds?: number;
  maxRetries?: number;
  retryWindowMs?: number;
  payload?: Record<string, unknown>;
}

export interface ReservationResult {
  reservationKey: string;
  ownerId: string;
  reserved: boolean;
  reservedUntil: string;
  reason?: string;
}

function toIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function claimTask(
  reservationKey: string,
  taskId: string,
  ownerId: string,
  options?: ReservationOptions
): Promise<ReservationResult> {
  const timeoutSeconds = Math.max(30, Number(options?.timeoutSeconds ?? 180));

  const lock = await acquireLock(`reservation:${reservationKey}`, ownerId, {
    leaseSeconds: Math.max(30, timeoutSeconds),
    retryWindowMs: options?.retryWindowMs ?? 300,
    maxRetries: options?.maxRetries ?? 1,
  });

  if (!lock.acquired) {
    return {
      reservationKey,
      ownerId,
      reserved: false,
      reservedUntil: new Date().toISOString(),
      reason: "reservation lock not acquired",
    };
  }

  try {
    const nowIso = new Date().toISOString();
    const reservedUntil = toIso(timeoutSeconds);

    // Try initial insert.
    const inserted = await supabaseServer.from("runtime_task_reservations").insert({
      reservation_key: reservationKey,
      task_id: taskId,
      owner_id: ownerId,
      status: "reserved",
      reserved_until: reservedUntil,
      attempts: 1,
      payload: options?.payload ?? {},
    });

    if (!inserted.error) {
      return { reservationKey, ownerId, reserved: true, reservedUntil };
    }

    // Take over if expired/terminal.
    const update = await supabaseServer
      .from("runtime_task_reservations")
      .update({
        task_id: taskId,
        owner_id: ownerId,
        status: "reserved",
        reserved_until: reservedUntil,
        updated_at: nowIso,
        payload: options?.payload ?? {},
      })
      .eq("reservation_key", reservationKey)
      .or(`reserved_until.lte.${nowIso},status.eq.completed,status.eq.failed,status.eq.released`)
      .select("id")
      .limit(1);

    if (!update.error && (update.data?.length ?? 0) > 0) {
      return { reservationKey, ownerId, reserved: true, reservedUntil };
    }

    return {
      reservationKey,
      ownerId,
      reserved: false,
      reservedUntil: new Date().toISOString(),
      reason: "reservation already owned and active",
    };
  } finally {
    await releaseLock(`reservation:${reservationKey}`, ownerId);
  }
}

export async function completeReservation(reservationKey: string, ownerId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("runtime_task_reservations")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("reservation_key", reservationKey)
    .eq("owner_id", ownerId)
    .select("id")
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

export async function failReservation(reservationKey: string, ownerId: string, message: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("runtime_task_reservations")
    .update({
      status: "failed",
      last_error: message,
      attempts: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("reservation_key", reservationKey)
    .eq("owner_id", ownerId)
    .select("id")
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

export async function releaseReservation(reservationKey: string, ownerId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("runtime_task_reservations")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("reservation_key", reservationKey)
    .eq("owner_id", ownerId)
    .select("id")
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

export async function withTaskReservation<T>(
  reservationKey: string,
  taskId: string,
  ownerId: string,
  action: () => Promise<T>,
  options?: ReservationOptions
): Promise<{ reserved: boolean; result: T | null; reason?: string }> {
  const claim = await claimTask(reservationKey, taskId, ownerId, options);
  if (!claim.reserved) {
    return {
      reserved: false,
      result: null,
      reason: claim.reason,
    };
  }

  try {
    const result = await action();
    await completeReservation(reservationKey, ownerId);
    return { reserved: true, result };
  } catch (error) {
    await failReservation(reservationKey, ownerId, String(error));
    throw error;
  } finally {
    await releaseReservation(reservationKey, ownerId);
  }
}
