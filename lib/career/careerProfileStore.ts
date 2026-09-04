import { appendFile, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { CareerProfileRecord } from "./careerTypes.ts"
import { supabaseServer } from "@/lib/supabaseServer"

// Vercel and most serverless platforms mount the deployment directory read-only.
// /tmp is the only writable path available at runtime. Fall back to process.cwd()
// only when /tmp is unavailable (e.g. local Windows dev where /tmp may not exist).
const RUNTIME_DIR = join(
  typeof process !== "undefined" && process.platform !== "win32" ? "/tmp" : process.cwd(),
  ".runtime",
)
const CAREER_PROFILE_LOG = join(RUNTIME_DIR, "career-profiles.jsonl")
const CAREER_PROFILES_TABLE = "career_profiles"

let initialized = false
let memoryLog: CareerProfileRecord[] = []

type CareerProfileRow = {
  id: string
  user_id: string | null
  created_at: string
  intake: CareerProfileRecord["intake"]
  profile: CareerProfileRecord["profile"]
  reconstruction: CareerProfileRecord["reconstruction"]
}

function isMissingCareerProfilesTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(CAREER_PROFILES_TABLE) && message.includes("could not find the table")
}

function isRecoverableStorageError(error: { message?: string } | null | undefined) {
  if (!error) {
    return false
  }

  const message = String(error.message || "").toLowerCase()
  return (
    isMissingCareerProfilesTable(error) ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("connection")
  )
}

function toCareerProfileRecord(row: CareerProfileRow): CareerProfileRecord {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    intake: row.intake,
    profile: row.profile,
    reconstruction: row.reconstruction,
  }
}

function toCareerProfileRow(record: CareerProfileRecord): CareerProfileRow {
  return {
    id: record.id,
    user_id: record.userId,
    created_at: record.createdAt,
    intake: record.intake,
    profile: record.profile,
    reconstruction: record.reconstruction,
  }
}

async function readLogFromDisk() {
  try {
    const content = await readFile(CAREER_PROFILE_LOG, "utf8")
    memoryLog = content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as CareerProfileRecord
        } catch {
          return null
        }
      })
      .filter((item): item is CareerProfileRecord => Boolean(item))
  } catch {
    memoryLog = []
  }
}

async function ensureInitialized() {
  if (initialized) {
    return
  }

  initialized = true
  try {
    await mkdir(RUNTIME_DIR, { recursive: true })
    await readLogFromDisk()
  } catch {
    // filesystem unavailable — memory-only fallback
  }
}

export async function appendCareerProfileRecord(
  input: Omit<CareerProfileRecord, "id" | "createdAt"> & { id?: string; createdAt?: string },
): Promise<CareerProfileRecord> {
  const entry: CareerProfileRecord = {
    ...input,
    id: input.id ?? `career-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }

  const { error } = await supabaseServer
    .from(CAREER_PROFILES_TABLE)
    .insert(toCareerProfileRow(entry))

  if (!error) {
    return entry
  }

  if (!isRecoverableStorageError(error)) {
    throw new Error(`Failed to persist career profile: ${error.message}`)
  }

  await ensureInitialized()
  memoryLog.push(entry)
  try {
    await appendFile(CAREER_PROFILE_LOG, `${JSON.stringify(entry)}\n`, "utf8")
  } catch {
    // filesystem fallback unavailable — record lives in memory only for this invocation
  }
  return entry
}

export async function listCareerProfileRecords(options: { userId?: string | null; limit?: number } = {}) {
  const userId = String(options.userId || "").trim() || null
  const limit = Math.max(1, options.limit ?? 50)

  let query = supabaseServer
    .from(CAREER_PROFILES_TABLE)
    .select("id, user_id, created_at, intake, profile, reconstruction")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (userId) {
    query = query.eq("user_id", userId)
  }

  const { data, error } = await query

  if (!error && Array.isArray(data)) {
    return data.map((row) => toCareerProfileRecord(row as CareerProfileRow))
  }

  if (error && !isRecoverableStorageError(error)) {
    throw new Error(`Failed to load career profiles: ${error.message}`)
  }

  await ensureInitialized()
  // Refresh from disk on each read so API routes running in separate runtimes stay consistent.
  await readLogFromDisk()

  return memoryLog
    .filter((entry) => !userId || entry.userId === userId)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}
