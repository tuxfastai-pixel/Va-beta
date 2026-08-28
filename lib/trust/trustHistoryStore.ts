import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { TrustMetrics, TrustMetricSignals } from "./trustMetrics.ts"
import { supabaseServer } from "@/lib/supabaseServer"

export type TrustRegime = "guarded" | "balanced" | "progressive"

export type TrustWindow = {
  timestamp: number
  metrics: TrustMetrics
  signals: TrustMetricSignals
  source?: string
}

export type TrustTransition = {
  timestamp: number
  previousRegime: TrustRegime
  nextRegime: TrustRegime
  reason: string
}

export type InterventionEffect = {
  timestamp: number
  interventionType: string
  perceivedSupport: number
  accepted: boolean
  notes?: string
}

export type PacingReaction = {
  timestamp: number
  pacingMode: string
  overwhelmSignal: number
  supportiveSignal: number
  reductionRequested: boolean
}

export type RecoveryOutcome = {
  timestamp: number
  strategy: string
  successful: boolean
  userConfidence: number
}

export type AutonomyAcceptance = {
  timestamp: number
  decisionType: string
  accepted: boolean
  requiredOverride: boolean
  comfort: number
}

export type TrustDriftAlert = {
  id: string
  timestamp: number
  kind:
    | "gradual_trust_erosion"
    | "oscillating_confidence"
    | "recovery_distrust"
    | "intervention_rejection"
    | "autonomy_discomfort_spike"
  severity: "low" | "medium" | "high"
  description: string
  evidence: Record<string, number | string>
}

export type TrustHistoryRecord = {
  userId: string
  trustWindows: TrustWindow[]
  transitions: TrustTransition[]
  interventionEffects: InterventionEffect[]
  pacingReactions: PacingReaction[]
  recoveryOutcomes: RecoveryOutcome[]
  autonomyAcceptance: AutonomyAcceptance[]
  driftAlerts: TrustDriftAlert[]
  updatedAt: number
}

type TrustHistoryState = {
  records: Record<string, TrustHistoryRecord>
}

type MutationOptions = {
  mutationKey?: string
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const STORE_FILE = join(RUNTIME_DIR, "trust-history-store.json")
const TRUST_HISTORY_TABLE = "trust_history_records"
const WINDOW_LIMIT = 180
const TRANSITION_LIMIT = 300
const EVENT_LIMIT = 400
const ALERT_LIMIT = 200
const LEDGER_LIMIT = 800

type TrustHistoryRow = {
  user_id: string
  record: unknown
  updated_at: string
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeSignals(raw: unknown): TrustMetricSignals {
  const source = isObject(raw) ? raw : {}
  return {
    recoveryAcceptanceRate: clamp01(Number(source.recoveryAcceptanceRate ?? 0.5)),
    resumeAbandonmentRate: clamp01(Number(source.resumeAbandonmentRate ?? 0.5)),
    repeatedRestartRate: clamp01(Number(source.repeatedRestartRate ?? 0.5)),
    sessionHesitationRate: clamp01(Number(source.sessionHesitationRate ?? 0.5)),
    notificationDismissalRate: clamp01(Number(source.notificationDismissalRate ?? 0.5)),
    modeOverrideRate: clamp01(Number(source.modeOverrideRate ?? 0.5)),
    rapidUiExitRate: clamp01(Number(source.rapidUiExitRate ?? 0.5)),
    reductionRequestRate: clamp01(Number(source.reductionRequestRate ?? 0.5)),
    rollbackFrequencyRate: clamp01(Number(source.rollbackFrequencyRate ?? 0.5)),
    trustDecayRate: clamp01(Number(source.trustDecayRate ?? 0.5)),
    oscillationExposureRate: clamp01(Number(source.oscillationExposureRate ?? 0.5)),
    recoverySuccessRate: clamp01(Number(source.recoverySuccessRate ?? 0.5)),
    interventionHelpfulRate: clamp01(Number(source.interventionHelpfulRate ?? 0.5)),
    interventionControllingRate: clamp01(Number(source.interventionControllingRate ?? 0.5)),
    interventionProtectiveRate: clamp01(Number(source.interventionProtectiveRate ?? 0.5)),
    interventionFrustratingRate: clamp01(Number(source.interventionFrustratingRate ?? 0.5)),
    automationComfortRate: clamp01(Number(source.automationComfortRate ?? 0.5)),
    adaptationComfortRate: clamp01(Number(source.adaptationComfortRate ?? 0.5)),
    orchestrationComfortRate: clamp01(Number(source.orchestrationComfortRate ?? 0.5)),
    autonomousPacingComfortRate: clamp01(Number(source.autonomousPacingComfortRate ?? 0.5)),
  }
}

function normalizeMetrics(raw: unknown): TrustMetrics {
  const source = isObject(raw) ? raw : {}
  return {
    continuityTrustScore: clamp01(Number(source.continuityTrustScore ?? 0.5)),
    pacingRespectScore: clamp01(Number(source.pacingRespectScore ?? 0.5)),
    perceivedReliability: clamp01(Number(source.perceivedReliability ?? 0.5)),
    interventionSupportScore: clamp01(Number(source.interventionSupportScore ?? 0.5)),
    adaptiveComfortIndex: clamp01(Number(source.adaptiveComfortIndex ?? 0.5)),
    compositeTrustScore: clamp01(Number(source.compositeTrustScore ?? 0.5)),
    computedAt: Number(source.computedAt ?? Date.now()),
  }
}

function normalizeRecord(userId: string, raw: unknown): TrustHistoryRecord {
  if (!isObject(raw)) {
    return {
      userId,
      trustWindows: [],
      transitions: [],
      interventionEffects: [],
      pacingReactions: [],
      recoveryOutcomes: [],
      autonomyAcceptance: [],
      driftAlerts: [],
      updatedAt: Date.now(),
    }
  }

  const trustWindows = Array.isArray(raw.trustWindows)
    ? raw.trustWindows
        .filter(isObject)
        .map((window) => ({
          timestamp: Number(window.timestamp ?? Date.now()),
          metrics: normalizeMetrics(window.metrics),
          signals: normalizeSignals(window.signals),
          source: typeof window.source === "string" ? window.source : undefined,
        }))
    : []

  const transitions = Array.isArray(raw.transitions)
    ? raw.transitions
        .filter(isObject)
        .map((transition) => {
          const previousRegime: TrustRegime =
            transition.previousRegime === "guarded" || transition.previousRegime === "balanced" || transition.previousRegime === "progressive"
              ? transition.previousRegime
              : "balanced"

          const nextRegime: TrustRegime =
            transition.nextRegime === "guarded" || transition.nextRegime === "balanced" || transition.nextRegime === "progressive"
              ? transition.nextRegime
              : "balanced"

          return {
            timestamp: Number(transition.timestamp ?? Date.now()),
            previousRegime,
            nextRegime,
            reason: String(transition.reason ?? "regime update"),
          }
        })
    : []

  const interventionEffects = Array.isArray(raw.interventionEffects)
    ? raw.interventionEffects
        .filter(isObject)
        .map((effect) => ({
          timestamp: Number(effect.timestamp ?? Date.now()),
          interventionType: String(effect.interventionType ?? "unknown"),
          perceivedSupport: clamp01(Number(effect.perceivedSupport ?? 0.5)),
          accepted: Boolean(effect.accepted ?? false),
          notes: typeof effect.notes === "string" ? effect.notes : undefined,
        }))
    : []

  const pacingReactions = Array.isArray(raw.pacingReactions)
    ? raw.pacingReactions
        .filter(isObject)
        .map((reaction) => ({
          timestamp: Number(reaction.timestamp ?? Date.now()),
          pacingMode: String(reaction.pacingMode ?? "balanced"),
          overwhelmSignal: clamp01(Number(reaction.overwhelmSignal ?? 0.5)),
          supportiveSignal: clamp01(Number(reaction.supportiveSignal ?? 0.5)),
          reductionRequested: Boolean(reaction.reductionRequested ?? false),
        }))
    : []

  const recoveryOutcomes = Array.isArray(raw.recoveryOutcomes)
    ? raw.recoveryOutcomes
        .filter(isObject)
        .map((outcome) => ({
          timestamp: Number(outcome.timestamp ?? Date.now()),
          strategy: String(outcome.strategy ?? "unknown"),
          successful: Boolean(outcome.successful ?? false),
          userConfidence: clamp01(Number(outcome.userConfidence ?? 0.5)),
        }))
    : []

  const autonomyAcceptance = Array.isArray(raw.autonomyAcceptance)
    ? raw.autonomyAcceptance
        .filter(isObject)
        .map((acceptance) => ({
          timestamp: Number(acceptance.timestamp ?? Date.now()),
          decisionType: String(acceptance.decisionType ?? "unknown"),
          accepted: Boolean(acceptance.accepted ?? false),
          requiredOverride: Boolean(acceptance.requiredOverride ?? false),
          comfort: clamp01(Number(acceptance.comfort ?? 0.5)),
        }))
    : []

  const driftAlerts = Array.isArray(raw.driftAlerts)
    ? raw.driftAlerts
        .filter(isObject)
        .map((alert) => {
          const kind: TrustDriftAlert["kind"] =
            alert.kind === "gradual_trust_erosion" ||
            alert.kind === "oscillating_confidence" ||
            alert.kind === "recovery_distrust" ||
            alert.kind === "intervention_rejection" ||
            alert.kind === "autonomy_discomfort_spike"
              ? alert.kind
              : "gradual_trust_erosion"

          const severity: TrustDriftAlert["severity"] =
            alert.severity === "low" || alert.severity === "medium" || alert.severity === "high"
              ? alert.severity
              : "low"

          return {
            id: String(alert.id ?? `drift-${Date.now().toString(16)}`),
            timestamp: Number(alert.timestamp ?? Date.now()),
            kind,
            severity,
            description: String(alert.description ?? "Trust drift signal detected"),
            evidence: isObject(alert.evidence) ? (alert.evidence as Record<string, number | string>) : {},
          }
        })
    : []

  return {
    userId,
    trustWindows: trustWindows.slice(-WINDOW_LIMIT),
    transitions: transitions.slice(-TRANSITION_LIMIT),
    interventionEffects: interventionEffects.slice(-EVENT_LIMIT),
    pacingReactions: pacingReactions.slice(-EVENT_LIMIT),
    recoveryOutcomes: recoveryOutcomes.slice(-EVENT_LIMIT),
    autonomyAcceptance: autonomyAcceptance.slice(-EVENT_LIMIT),
    driftAlerts: driftAlerts.slice(-ALERT_LIMIT),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
  }
}

function isMissingTrustHistoryTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(TRUST_HISTORY_TABLE) && message.includes("could not find the table")
}

function shouldFallbackToFile(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return (
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("etimedout")
  )
}

function toTrustHistoryRow(record: TrustHistoryRecord): TrustHistoryRow {
  return {
    user_id: record.userId,
    record,
    updated_at: new Date(record.updatedAt).toISOString(),
  }
}

async function loadStore(): Promise<TrustHistoryState> {
  try {
    const { data, error } = await supabaseServer
      .from(TRUST_HISTORY_TABLE)
      .select("user_id, record, updated_at")

    if (!error && Array.isArray(data)) {
      const records: Record<string, TrustHistoryRecord> = {}
      for (const row of data as TrustHistoryRow[]) {
        records[row.user_id] = normalizeRecord(row.user_id, row.record)
      }
      return { records }
    }

    if (error && !isMissingTrustHistoryTable(error) && !shouldFallbackToFile(error)) {
      throw new Error(`Failed to load trust history records: ${error.message}`)
    }
  } catch (error) {
    if (!shouldFallbackToFile(error as { message?: string })) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load trust history records: ${message}`)
    }
  }

  await mkdir(RUNTIME_DIR, { recursive: true })
  try {
    const raw = await readFile(STORE_FILE, "utf8")
    const parsed = JSON.parse(raw) as { records?: Record<string, unknown> }
    const records: Record<string, TrustHistoryRecord> = {}

    for (const [userId, value] of Object.entries(parsed.records ?? {})) {
      records[userId] = normalizeRecord(userId, value)
    }

    return { records }
  } catch {
    return { records: {} }
  }
}

async function saveStore(state: TrustHistoryState): Promise<void> {
  try {
    const rows = Object.values(state.records).map((record) => toTrustHistoryRow(record))
    const { error } = await supabaseServer
      .from(TRUST_HISTORY_TABLE)
      .upsert(rows, { onConflict: "user_id" })

    if (!error) {
      return
    }

    if (error && !isMissingTrustHistoryTable(error) && !shouldFallbackToFile(error)) {
      throw new Error(`Failed to persist trust history records: ${error.message}`)
    }
  } catch (error) {
    if (!shouldFallbackToFile(error as { message?: string })) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to persist trust history records: ${message}`)
    }
  }

  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(state, null, 2), "utf8")
}

function ensureRecord(state: TrustHistoryState, userId: string): TrustHistoryRecord {
  if (!state.records[userId]) {
    state.records[userId] = normalizeRecord(userId, null)
    ;(state.records[userId] as TrustHistoryRecord & { _ledger?: string[] })._ledger = []
  }
  return state.records[userId]
}

function getLedger(record: TrustHistoryRecord): string[] {
  const value = (record as TrustHistoryRecord & { _ledger?: string[] })._ledger
  if (Array.isArray(value)) {
    return value
  }
  ;(record as TrustHistoryRecord & { _ledger?: string[] })._ledger = []
  return (record as TrustHistoryRecord & { _ledger?: string[] })._ledger as string[]
}

function isDuplicateMutation(record: TrustHistoryRecord, key?: string): boolean {
  if (!key) {
    return false
  }
  return getLedger(record).includes(key)
}

function trackMutation(record: TrustHistoryRecord, key?: string): void {
  if (!key) {
    return
  }

  const ledger = getLedger(record)
  if (ledger.includes(key)) {
    return
  }

  ledger.push(key)
  if (ledger.length > LEDGER_LIMIT) {
    ;(record as TrustHistoryRecord & { _ledger?: string[] })._ledger = ledger.slice(-LEDGER_LIMIT)
  }
}

export async function loadTrustHistoryRecord(userId: string): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  return ensureRecord(state, userId)
}

export async function listTrustHistoryRecords(limit = 200): Promise<TrustHistoryRecord[]> {
  const state = await loadStore()
  return Object.values(state.records)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(1, limit))
}

export async function appendTrustWindow(
  userId: string,
  payload: Omit<TrustWindow, "timestamp"> & { timestamp?: number },
  options: MutationOptions = {},
): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.trustWindows.push({
    timestamp: Number(payload.timestamp ?? Date.now()),
    metrics: normalizeMetrics(payload.metrics),
    signals: normalizeSignals(payload.signals),
    source: payload.source,
  })

  if (record.trustWindows.length > WINDOW_LIMIT) {
    record.trustWindows = record.trustWindows.slice(-WINDOW_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)
  await saveStore(state)
  return record
}

export async function appendTrustTransition(
  userId: string,
  transition: TrustTransition,
  options: MutationOptions = {},
): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.transitions.push(transition)
  if (record.transitions.length > TRANSITION_LIMIT) {
    record.transitions = record.transitions.slice(-TRANSITION_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)
  await saveStore(state)
  return record
}

export async function appendInterventionEffect(
  userId: string,
  effect: InterventionEffect,
  options: MutationOptions = {},
): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.interventionEffects.push(effect)
  if (record.interventionEffects.length > EVENT_LIMIT) {
    record.interventionEffects = record.interventionEffects.slice(-EVENT_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)
  await saveStore(state)
  return record
}

export async function appendPacingReaction(
  userId: string,
  reaction: PacingReaction,
  options: MutationOptions = {},
): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.pacingReactions.push(reaction)
  if (record.pacingReactions.length > EVENT_LIMIT) {
    record.pacingReactions = record.pacingReactions.slice(-EVENT_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)
  await saveStore(state)
  return record
}

export async function appendRecoveryOutcome(
  userId: string,
  outcome: RecoveryOutcome,
  options: MutationOptions = {},
): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.recoveryOutcomes.push(outcome)
  if (record.recoveryOutcomes.length > EVENT_LIMIT) {
    record.recoveryOutcomes = record.recoveryOutcomes.slice(-EVENT_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)
  await saveStore(state)
  return record
}

export async function appendAutonomyAcceptance(
  userId: string,
  acceptance: AutonomyAcceptance,
  options: MutationOptions = {},
): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  record.autonomyAcceptance.push(acceptance)
  if (record.autonomyAcceptance.length > EVENT_LIMIT) {
    record.autonomyAcceptance = record.autonomyAcceptance.slice(-EVENT_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)
  await saveStore(state)
  return record
}

export async function appendTrustDriftAlerts(
  userId: string,
  alerts: TrustDriftAlert[],
  options: MutationOptions = {},
): Promise<TrustHistoryRecord> {
  const state = await loadStore()
  const record = ensureRecord(state, userId)

  if (isDuplicateMutation(record, options.mutationKey)) {
    return record
  }

  const seenIds = new Set(record.driftAlerts.map((alert) => alert.id))
  for (const alert of alerts) {
    if (!seenIds.has(alert.id)) {
      record.driftAlerts.push(alert)
      seenIds.add(alert.id)
    }
  }

  if (record.driftAlerts.length > ALERT_LIMIT) {
    record.driftAlerts = record.driftAlerts.slice(-ALERT_LIMIT)
  }

  record.updatedAt = Date.now()
  trackMutation(record, options.mutationKey)
  await saveStore(state)
  return record
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function summarizeTrustHistory(record: TrustHistoryRecord) {
  const windows = record.trustWindows.slice(-20)
  const latest = windows[windows.length - 1] ?? null
  const previous = windows.slice(0, -1)

  const latestScore = latest?.metrics.compositeTrustScore ?? 0
  const baseline = previous.length > 0 ? average(previous.map((window) => window.metrics.compositeTrustScore)) : latestScore
  const trustMomentum = latestScore - baseline

  return {
    userId: record.userId,
    trustRegime: record.transitions[record.transitions.length - 1]?.nextRegime ?? "balanced",
    trustMomentum,
    latestMetrics: latest?.metrics ?? null,
    latestSignals: latest?.signals ?? null,
    pacingAcceptance:
      windows.length > 0
        ? average(windows.map((window) => 1 - window.signals.reductionRequestRate))
        : 0,
    interventionSupportiveness:
      windows.length > 0 ? average(windows.map((window) => window.metrics.interventionSupportScore)) : 0,
    autonomyComfort:
      windows.length > 0 ? average(windows.map((window) => window.metrics.adaptiveComfortIndex)) : 0,
    recoverySuccess:
      windows.length > 0 ? average(windows.map((window) => window.signals.recoverySuccessRate)) : 0,
    driftAlerts: record.driftAlerts.slice(-10),
    transitionCount: record.transitions.length,
    updatedAt: record.updatedAt,
  }
}
