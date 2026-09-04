import { mkdir, readFile, appendFile } from "node:fs/promises"
import { join } from "node:path"

export type GovernanceIntervention = {
  id: string
  timestamp: number
  actor: string
  action: string
  rationale: string
  metadata?: Record<string, unknown>
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const LOG_FILE = join(RUNTIME_DIR, "governance-interventions.jsonl")

let initialized = false
let interventions: GovernanceIntervention[] = []

async function ensureInitialized() {
  if (initialized) {
    return
  }

  initialized = true
  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const raw = await readFile(LOG_FILE, "utf8")
    interventions = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as GovernanceIntervention
        } catch {
          return null
        }
      })
      .filter((item): item is GovernanceIntervention => Boolean(item))
  } catch {
    interventions = []
  }
}

export async function listGovernanceInterventions(limit = 200) {
  await ensureInitialized()
  return interventions.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, Math.max(1, limit))
}

export async function logGovernanceIntervention(
  intervention: Omit<GovernanceIntervention, "id" | "timestamp">,
) {
  await ensureInitialized()
  const entry: GovernanceIntervention = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Date.now(),
    ...intervention,
  }

  interventions.push(entry)
  await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8")
  return entry
}
