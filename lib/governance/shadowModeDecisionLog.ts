import { mkdir, readFile, appendFile } from "node:fs/promises"
import { join } from "node:path"

export type ShadowModeDecisionEntry = {
  id: string
  timestamp: number
  userId: string
  decision: string
  confidence: number
  expectedBenefit: {
    expectedFatigueReduction: number
    expectedTrustStabilityGain: number
  }
  actualOutcome?: {
    fatigueActuallyRose: boolean
    trustActuallyDropped: boolean
  }
  metadata?: Record<string, unknown>
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const LOG_FILE = join(RUNTIME_DIR, "shadow-mode-decisions.jsonl")

let initialized = false
let memoryLog: ShadowModeDecisionEntry[] = []

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

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
          return JSON.parse(line) as ShadowModeDecisionEntry
        } catch {
          return null
        }
      })
      .filter((item): item is ShadowModeDecisionEntry => Boolean(item))
  } catch {
    memoryLog = []
  }
}

export async function appendShadowModeDecision(
  decision: Omit<ShadowModeDecisionEntry, "id" | "timestamp"> & { timestamp?: number },
): Promise<ShadowModeDecisionEntry> {
  await ensureInitialized()

  const entry: ShadowModeDecisionEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Number(decision.timestamp ?? Date.now()),
    userId: decision.userId,
    decision: decision.decision,
    confidence: clamp01(decision.confidence),
    expectedBenefit: {
      expectedFatigueReduction: clamp01(decision.expectedBenefit.expectedFatigueReduction),
      expectedTrustStabilityGain: clamp01(decision.expectedBenefit.expectedTrustStabilityGain),
    },
    actualOutcome: decision.actualOutcome,
    metadata: decision.metadata ?? {},
  }

  memoryLog.push(entry)
  await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8")
  return entry
}

export async function listShadowModeDecisions(limit = 300): Promise<ShadowModeDecisionEntry[]> {
  await ensureInitialized()
  return memoryLog
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, Math.max(1, limit))
}
