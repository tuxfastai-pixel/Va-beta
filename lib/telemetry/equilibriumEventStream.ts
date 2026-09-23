import { mkdir, readFile, appendFile } from "node:fs/promises"
import { join } from "node:path"
import { supabaseServer } from "@/lib/supabaseServer"

export type EquilibriumEvent = {
  userId: string
  timestamp: number
  eventType: string
  previousState: string
  nextState: string
  pressureLevel: number
  fatigueRisk: number
  recoveryTriggered: boolean
  metadata?: Record<string, unknown>
}

type EventListOptions = {
  userId?: string
  eventType?: string
  sinceTimestamp?: number
  limit?: number
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const EVENT_FILE = join(RUNTIME_DIR, "equilibrium-events.jsonl")
const MEMORY_LIMIT = 50_000
const EQUILIBRIUM_EVENTS_TABLE = "equilibrium_events"

type EquilibriumEventRow = {
  user_id: string
  event_timestamp: number
  event_type: string
  previous_state: string
  next_state: string
  pressure_level: number
  fatigue_risk: number
  recovery_triggered: boolean
  metadata: Record<string, unknown>
}

let initialized = false
let memoryEvents: EquilibriumEvent[] = []

function isMissingEquilibriumEventsTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(EQUILIBRIUM_EVENTS_TABLE) && message.includes("could not find the table")
}

function toEventRow(event: EquilibriumEvent): EquilibriumEventRow {
  return {
    user_id: event.userId,
    event_timestamp: event.timestamp,
    event_type: event.eventType,
    previous_state: event.previousState,
    next_state: event.nextState,
    pressure_level: event.pressureLevel,
    fatigue_risk: event.fatigueRisk,
    recovery_triggered: event.recoveryTriggered,
    metadata: event.metadata ?? {},
  }
}

function fromEventRow(row: EquilibriumEventRow): EquilibriumEvent {
  return {
    userId: row.user_id,
    timestamp: Number(row.event_timestamp),
    eventType: row.event_type,
    previousState: row.previous_state,
    nextState: row.next_state,
    pressureLevel: clamp01(Number(row.pressure_level)),
    fatigueRisk: clamp01(Number(row.fatigue_risk)),
    recoveryTriggered: Boolean(row.recovery_triggered),
    metadata: row.metadata ?? {},
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeEvent(event: Partial<EquilibriumEvent> & Pick<EquilibriumEvent, "userId" | "eventType">): EquilibriumEvent {
  return {
    userId: event.userId,
    timestamp: Number(event.timestamp ?? Date.now()),
    eventType: String(event.eventType),
    previousState: String(event.previousState ?? "unknown"),
    nextState: String(event.nextState ?? "unknown"),
    pressureLevel: clamp01(Number(event.pressureLevel ?? 0.5)),
    fatigueRisk: clamp01(Number(event.fatigueRisk ?? 0.5)),
    recoveryTriggered: Boolean(event.recoveryTriggered ?? false),
    metadata: event.metadata ?? {},
  }
}

async function ensureInitialized() {
  if (initialized) {
    return
  }

  initialized = true
  const { data, error } = await supabaseServer
    .from(EQUILIBRIUM_EVENTS_TABLE)
    .select("user_id, event_timestamp, event_type, previous_state, next_state, pressure_level, fatigue_risk, recovery_triggered, metadata")
    .order("event_timestamp", { ascending: true })
    .limit(MEMORY_LIMIT)

  if (!error && Array.isArray(data)) {
    memoryEvents = (data as EquilibriumEventRow[]).map((row) => fromEventRow(row)).slice(-MEMORY_LIMIT)
    return
  }

  if (error && !isMissingEquilibriumEventsTable(error)) {
    throw new Error(`Failed to load equilibrium events: ${error.message}`)
  }

  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const content = await readFile(EVENT_FILE, "utf8")
    const events = content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as EquilibriumEvent
        } catch {
          return null
        }
      })
      .filter((event): event is EquilibriumEvent => Boolean(event))

    memoryEvents = events.slice(-MEMORY_LIMIT)
  } catch {
    memoryEvents = []
  }
}

export async function appendEquilibriumEvent(event: Partial<EquilibriumEvent> & Pick<EquilibriumEvent, "userId" | "eventType">) {
  await ensureInitialized()
  const normalized = normalizeEvent(event)

  memoryEvents.push(normalized)
  if (memoryEvents.length > MEMORY_LIMIT) {
    memoryEvents = memoryEvents.slice(memoryEvents.length - MEMORY_LIMIT)
  }

  const { error } = await supabaseServer
    .from(EQUILIBRIUM_EVENTS_TABLE)
    .insert(toEventRow(normalized))

  if (!error) {
    return normalized
  }

  if (error && !isMissingEquilibriumEventsTable(error)) {
    throw new Error(`Failed to persist equilibrium event: ${error.message}`)
  }

  try {
    await appendFile(EVENT_FILE, `${JSON.stringify(normalized)}\n`, "utf8")
  } catch (error) {
    console.error("appendEquilibriumEvent persistence error:", error)
  }

  return normalized
}

export async function appendEquilibriumEvents(
  events: Array<Partial<EquilibriumEvent> & Pick<EquilibriumEvent, "userId" | "eventType">>,
) {
  const output: EquilibriumEvent[] = []
  for (const event of events) {
    output.push(await appendEquilibriumEvent(event))
  }
  return output
}

export async function listEquilibriumEvents(options: EventListOptions = {}) {
  const limit = typeof options.limit === "number" ? Math.max(1, options.limit) : 200

  let query = supabaseServer
    .from(EQUILIBRIUM_EVENTS_TABLE)
    .select("user_id, event_timestamp, event_type, previous_state, next_state, pressure_level, fatigue_risk, recovery_triggered, metadata")
    .order("event_timestamp", { ascending: false })
    .limit(limit)

  if (options.userId) {
    query = query.eq("user_id", options.userId)
  }

  if (options.eventType) {
    query = query.eq("event_type", options.eventType)
  }

  if (typeof options.sinceTimestamp === "number") {
    query = query.gte("event_timestamp", options.sinceTimestamp)
  }

  const { data, error } = await query

  if (!error && Array.isArray(data)) {
    return (data as EquilibriumEventRow[]).map((row) => fromEventRow(row))
  }

  if (error && !isMissingEquilibriumEventsTable(error)) {
    throw new Error(`Failed to list equilibrium events: ${error.message}`)
  }

  await ensureInitialized()

  let filtered = memoryEvents

  if (options.userId) {
    filtered = filtered.filter((event) => event.userId === options.userId)
  }

  if (options.eventType) {
    filtered = filtered.filter((event) => event.eventType === options.eventType)
  }

  if (typeof options.sinceTimestamp === "number") {
    const sinceTimestamp = options.sinceTimestamp
    filtered = filtered.filter((event) => event.timestamp >= sinceTimestamp)
  }

  filtered = filtered.slice().sort((a, b) => b.timestamp - a.timestamp)

  if (typeof options.limit === "number") {
    return filtered.slice(0, Math.max(1, options.limit))
  }

  return filtered
}

export async function getEquilibriumEventStats() {
  await ensureInitialized()

  const byType: Record<string, number> = {}
  for (const event of memoryEvents) {
    byType[event.eventType] = (byType[event.eventType] || 0) + 1
  }

  return {
    total: memoryEvents.length,
    byType,
    oldestTimestamp: memoryEvents[0]?.timestamp ?? null,
    newestTimestamp: memoryEvents[memoryEvents.length - 1]?.timestamp ?? null,
  }
}
