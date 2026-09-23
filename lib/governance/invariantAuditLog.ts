import { appendFile, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import type { GovernanceInvariantId } from "./governanceInvariants.ts"

export type InvariantAuditEntry = {
  id: string
  timestamp: number
  invariantId: GovernanceInvariantId
  userId: string | null
  blockedAction: string
  severity: "high" | "medium"
  context: Record<string, unknown>
  downstreamActionTaken: string
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const LOG_FILE = join(RUNTIME_DIR, "invariant-audit-log.jsonl")

let initialized = false
let entries: InvariantAuditEntry[] = []

async function ensureInitialized() {
  if (initialized) {
    return
  }

  initialized = true
  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const raw = await readFile(LOG_FILE, "utf8")
    entries = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as InvariantAuditEntry
        } catch {
          return null
        }
      })
      .filter((entry): entry is InvariantAuditEntry => Boolean(entry))
  } catch {
    entries = []
  }
}

export async function appendInvariantAuditEntry(
  input: Omit<InvariantAuditEntry, "id" | "timestamp"> & { timestamp?: number },
): Promise<InvariantAuditEntry> {
  await ensureInitialized()

  const entry: InvariantAuditEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Number(input.timestamp ?? Date.now()),
    invariantId: input.invariantId,
    userId: input.userId ?? null,
    blockedAction: input.blockedAction,
    severity: input.severity,
    context: input.context,
    downstreamActionTaken: input.downstreamActionTaken,
  }

  entries.push(entry)
  await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8")
  return entry
}

export async function listInvariantAuditEntries(options: {
  limit?: number
  userId?: string | null
} = {}): Promise<InvariantAuditEntry[]> {
  await ensureInitialized()
  const limit = Math.max(1, options.limit ?? 200)
  const userId = options.userId?.trim() || null

  return entries
    .filter((entry) => !userId || entry.userId === userId)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}
