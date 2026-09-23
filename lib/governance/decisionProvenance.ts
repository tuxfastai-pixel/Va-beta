import { appendFile, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"

export type GovernanceDecisionProvenance = {
  id: string
  timestamp: number
  userId: string
  action: string
  originatingSignals: Record<string, number | string | boolean>
  trustInputs: Record<string, number | string>
  fatigueInputs: Record<string, number | string>
  personalizationFactors: Record<string, number | string | boolean>
  rolloutPosture: Record<string, string | boolean | number>
  invariantChecks: Array<{ id: string; passed: boolean; detail: string }>
  rejectedAlternatives: Array<{ action: string; reason: string }>
  confidenceScore: number
  shadowComparison: {
    shadowDecision: string
    liveDecision: string
    diverged: boolean
  }
  finalAuthoritySource:
    | "operator"
    | "invariant"
    | "confidence"
    | "rollout-mode"
    | "trust-gate"
    | "default"
    | "shadow-mode"
    | "trust-regulation"
    | "permission-boundary"
    | "rollback-risk"
    | "runtime-integrity"
  parentId?: string
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const LOG_FILE = join(RUNTIME_DIR, "decision-provenance.jsonl")

let initialized = false
let memoryLog: GovernanceDecisionProvenance[] = []

async function ensureInitialized() {
  if (initialized) {
    return
  }

  initialized = true
  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const content = await readFile(LOG_FILE, "utf8")
    memoryLog = content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as GovernanceDecisionProvenance
        } catch {
          return null
        }
      })
      .filter((item): item is GovernanceDecisionProvenance => Boolean(item))
  } catch {
    memoryLog = []
  }
}

export async function appendDecisionProvenance(
  input: Omit<GovernanceDecisionProvenance, "id" | "timestamp"> & { timestamp?: number; id?: string },
): Promise<GovernanceDecisionProvenance> {
  await ensureInitialized()

  const entry: GovernanceDecisionProvenance = {
    ...input,
    id: input.id ?? `prov-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Number(input.timestamp ?? Date.now()),
  }

  memoryLog.push(entry)
  await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8")
  return entry
}

export async function listDecisionProvenance(options: {
  userId?: string | null
  limit?: number
} = {}): Promise<GovernanceDecisionProvenance[]> {
  await ensureInitialized()
  const userId = options.userId?.trim() || null
  const limit = Math.max(1, options.limit ?? 300)

  return memoryLog
    .filter((entry) => !userId || entry.userId === userId)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}

export async function getDecisionProvenanceChain(id: string): Promise<GovernanceDecisionProvenance[]> {
  await ensureInitialized()
  const byId = new Map(memoryLog.map((item) => [item.id, item]))
  const chain: GovernanceDecisionProvenance[] = []
  let cursor: GovernanceDecisionProvenance | undefined = byId.get(id)

  while (cursor) {
    chain.push(cursor)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }

  return chain
}
