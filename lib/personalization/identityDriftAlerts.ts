import { mkdir, readFile, appendFile } from "node:fs/promises"
import { join } from "node:path"

export type IdentityDriftAlert = {
  id: string
  userId: string
  timestamp: number
  delta: number
  previousFingerprint: string
  nextFingerprint: string
  summary: string
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const ALERTS_FILE = join(RUNTIME_DIR, "personalization-identity-drift.jsonl")

let initialized = false
let memoryAlerts: IdentityDriftAlert[] = []

async function ensureInitialized() {
  if (initialized) {
    return
  }

  initialized = true
  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const raw = await readFile(ALERTS_FILE, "utf8")
    memoryAlerts = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as IdentityDriftAlert
        } catch {
          return null
        }
      })
      .filter((item): item is IdentityDriftAlert => Boolean(item))
      .slice(-5_000)
  } catch {
    memoryAlerts = []
  }
}

export async function appendIdentityDriftAlert(
  alert: Omit<IdentityDriftAlert, "id" | "timestamp"> & { timestamp?: number },
) {
  await ensureInitialized()
  const entry: IdentityDriftAlert = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: alert.timestamp ?? Date.now(),
    ...alert,
  }

  memoryAlerts.push(entry)
  if (memoryAlerts.length > 5_000) {
    memoryAlerts = memoryAlerts.slice(memoryAlerts.length - 5_000)
  }

  await appendFile(ALERTS_FILE, `${JSON.stringify(entry)}\n`, "utf8")
  return entry
}

export async function listIdentityDriftAlerts(options?: { userId?: string; limit?: number }) {
  await ensureInitialized()
  const filtered = options?.userId
    ? memoryAlerts.filter((item) => item.userId === options.userId)
    : memoryAlerts

  const sorted = filtered.slice().sort((a, b) => b.timestamp - a.timestamp)
  return sorted.slice(0, Math.max(1, options?.limit ?? 100))
}
