import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { SessionSnapshot } from "./sessionSnapshot.ts"

export type InterruptionCauseType =
  | "browser_crash"
  | "api_failure"
  | "websocket_disconnect"
  | "mobile_background_resume"
  | "telemetry_corruption"
  | "partial_orchestration_failure"
  | "interrupted_recovery_cycle"
  | "interrupted_autonomous_regulation"
  | "unknown"

export type InterruptionCause = {
  timestamp: number
  cause: InterruptionCauseType
  details?: Record<string, unknown>
}

export type RecoveryCheckpoint = {
  timestamp: number
  snapshot: SessionSnapshot
  strategy?: string
  progress?: number
}

export type EquilibriumRecoveryHistoryItem = {
  timestamp: number
  phase: "resume" | "simplify" | "recover" | "stabilize"
  strategy: string
  confidence: number
  note?: string
}

export type SessionContinuityRecord = {
  userId: string
  latestStableSnapshot: SessionSnapshot | null
  lastStableWorkspace: SessionSnapshot["workspaceState"] | null
  recoveryCheckpoints: RecoveryCheckpoint[]
  equilibriumRecoveryHistory: EquilibriumRecoveryHistoryItem[]
  interruptionCauses: InterruptionCause[]
  mutationLedger: string[]
  updatedAt: number
}

type ContinuityStoreState = {
  records: Record<string, SessionContinuityRecord>
}

type MutationOptions = {
  mutationKey?: string
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const STORE_FILE = join(RUNTIME_DIR, "session-continuity-store.json")
const CHECKPOINT_LIMIT = 40
const HISTORY_LIMIT = 120
const INTERRUPTION_LIMIT = 120
const MUTATION_LEDGER_LIMIT = 600

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5
  }
  return Math.max(0, Math.min(1, value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeInterruptionCause(value: unknown): InterruptionCause | null {
  if (!isObject(value)) {
    return null
  }

  const cause = typeof value.cause === "string" ? value.cause : "unknown"
  const normalizedCause: InterruptionCauseType =
    cause === "browser_crash" ||
    cause === "api_failure" ||
    cause === "websocket_disconnect" ||
    cause === "mobile_background_resume" ||
    cause === "telemetry_corruption" ||
    cause === "partial_orchestration_failure" ||
    cause === "interrupted_recovery_cycle" ||
    cause === "interrupted_autonomous_regulation"
      ? cause
      : "unknown"

  return {
    timestamp: Number(value.timestamp ?? Date.now()),
    cause: normalizedCause,
    details: isObject(value.details) ? value.details : undefined,
  }
}

function normalizeRecord(userId: string, value: unknown): SessionContinuityRecord {
  if (!isObject(value)) {
    return {
      userId,
      latestStableSnapshot: null,
      lastStableWorkspace: null,
      recoveryCheckpoints: [],
      equilibriumRecoveryHistory: [],
      interruptionCauses: [],
      mutationLedger: [],
      updatedAt: Date.now(),
    }
  }

  const recoveryCheckpoints = Array.isArray(value.recoveryCheckpoints)
    ? value.recoveryCheckpoints
        .filter((item) => isObject(item) && isObject(item.snapshot))
        .map((item) => ({
          timestamp: Number(item.timestamp ?? Date.now()),
          snapshot: item.snapshot as SessionSnapshot,
          strategy: typeof item.strategy === "string" ? item.strategy : undefined,
          progress: typeof item.progress === "number" ? clamp01(item.progress) : undefined,
        }))
    : []

  const recoveryHistory = Array.isArray(value.equilibriumRecoveryHistory)
    ? value.equilibriumRecoveryHistory
        .filter(isObject)
        .map((item) => {
          const phase: EquilibriumRecoveryHistoryItem["phase"] =
            item.phase === "resume" || item.phase === "simplify" || item.phase === "recover" || item.phase === "stabilize"
              ? item.phase
              : "stabilize"

          return {
            timestamp: Number(item.timestamp ?? Date.now()),
            phase,
            strategy: String(item.strategy ?? "safety_baseline"),
            confidence: clamp01(Number(item.confidence ?? 0.5)),
            note: typeof item.note === "string" ? item.note : undefined,
          }
        })
    : []

  const interruptionCauses = Array.isArray(value.interruptionCauses)
    ? value.interruptionCauses.map(normalizeInterruptionCause).filter((item): item is InterruptionCause => item !== null)
    : []

  const mutationLedger = Array.isArray(value.mutationLedger)
    ? value.mutationLedger.filter((item): item is string => typeof item === "string")
    : []

  return {
    userId,
    latestStableSnapshot: isObject(value.latestStableSnapshot)
      ? (value.latestStableSnapshot as SessionSnapshot)
      : null,
    lastStableWorkspace: isObject(value.lastStableWorkspace)
      ? (value.lastStableWorkspace as SessionSnapshot["workspaceState"])
      : null,
    recoveryCheckpoints: recoveryCheckpoints.slice(-CHECKPOINT_LIMIT),
    equilibriumRecoveryHistory: recoveryHistory.slice(-HISTORY_LIMIT),
    interruptionCauses: interruptionCauses.slice(-INTERRUPTION_LIMIT),
    mutationLedger: mutationLedger.slice(-MUTATION_LEDGER_LIMIT),
    updatedAt: Number(value.updatedAt ?? Date.now()),
  }
}

async function loadStoreState(): Promise<ContinuityStoreState> {
  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const raw = await readFile(STORE_FILE, "utf8")
    const parsed = JSON.parse(raw) as { records?: Record<string, unknown> }
    const records: Record<string, SessionContinuityRecord> = {}

    for (const [userId, value] of Object.entries(parsed.records ?? {})) {
      records[userId] = normalizeRecord(userId, value)
    }

    return { records }
  } catch {
    return { records: {} }
  }
}

async function saveStoreState(state: ContinuityStoreState): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(state, null, 2), "utf8")
}

function ensureRecord(state: ContinuityStoreState, userId: string): SessionContinuityRecord {
  if (!state.records[userId]) {
    state.records[userId] = normalizeRecord(userId, null)
  }
  return state.records[userId]
}

function isDuplicateMutation(record: SessionContinuityRecord, mutationKey?: string): boolean {
  if (!mutationKey) {
    return false
  }
  return record.mutationLedger.includes(mutationKey)
}

function trackMutation(record: SessionContinuityRecord, mutationKey?: string): void {
  if (!mutationKey) {
    return
  }
  if (record.mutationLedger.includes(mutationKey)) {
    return
  }
  record.mutationLedger.push(mutationKey)
  if (record.mutationLedger.length > MUTATION_LEDGER_LIMIT) {
    record.mutationLedger = record.mutationLedger.slice(-MUTATION_LEDGER_LIMIT)
  }
}

export async function loadSessionContinuityRecord(userId: string): Promise<SessionContinuityRecord> {
  const state = await loadStoreState()
  return ensureRecord(state, userId)
}

export async function persistStableSnapshot(
  snapshot: SessionSnapshot,
  options: MutationOptions = {},
): Promise<SessionContinuityRecord> {
  const state = await loadStoreState()
  const record = ensureRecord(state, snapshot.userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.latestStableSnapshot = snapshot
  record.lastStableWorkspace = snapshot.workspaceState
  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)

  await saveStoreState(state)
  return record
}

export async function appendRecoveryCheckpoint(
  userId: string,
  checkpoint: RecoveryCheckpoint,
  options: MutationOptions = {},
): Promise<SessionContinuityRecord> {
  const state = await loadStoreState()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.recoveryCheckpoints.push({
    ...checkpoint,
    progress: typeof checkpoint.progress === "number" ? clamp01(checkpoint.progress) : undefined,
  })
  if (record.recoveryCheckpoints.length > CHECKPOINT_LIMIT) {
    record.recoveryCheckpoints = record.recoveryCheckpoints.slice(-CHECKPOINT_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)

  await saveStoreState(state)
  return record
}

export async function appendRecoveryHistory(
  userId: string,
  item: EquilibriumRecoveryHistoryItem,
  options: MutationOptions = {},
): Promise<SessionContinuityRecord> {
  const state = await loadStoreState()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.equilibriumRecoveryHistory.push({
    ...item,
    confidence: clamp01(item.confidence),
  })
  if (record.equilibriumRecoveryHistory.length > HISTORY_LIMIT) {
    record.equilibriumRecoveryHistory = record.equilibriumRecoveryHistory.slice(-HISTORY_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)

  await saveStoreState(state)
  return record
}

export async function appendInterruptionCause(
  userId: string,
  cause: InterruptionCause,
  options: MutationOptions = {},
): Promise<SessionContinuityRecord> {
  const state = await loadStoreState()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.interruptionCauses.push({
    timestamp: Number(cause.timestamp ?? Date.now()),
    cause: cause.cause,
    details: cause.details,
  })
  if (record.interruptionCauses.length > INTERRUPTION_LIMIT) {
    record.interruptionCauses = record.interruptionCauses.slice(-INTERRUPTION_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)

  await saveStoreState(state)
  return record
}
