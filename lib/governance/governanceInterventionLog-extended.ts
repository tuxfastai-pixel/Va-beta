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

export type GovernanceAction = {
  id: string
  timestamp: number
  userId: string
  action: string
  rationale: string
  source: "admin-governance" | "autonomous-system" | "governance-workflow"
  result?: "applied" | "pending" | "rejected"
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const LOG_FILE = join(RUNTIME_DIR, "governance-interventions.jsonl")
const ACTIONS_FILE = join(RUNTIME_DIR, "governance-actions.jsonl")

let initialized = false
let interventions: GovernanceIntervention[] = []
let actions: GovernanceAction[] = []

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

  try {
    const raw = await readFile(ACTIONS_FILE, "utf8")
    actions = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as GovernanceAction
        } catch {
          return null
        }
      })
      .filter((item): item is GovernanceAction => Boolean(item))
      .slice(-5000)
  } catch {
    actions = []
  }
}

export async function listGovernanceInterventions(limit = 200) {
  await ensureInitialized()
  return interventions.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, Math.max(1, limit))
}

export async function saveGovernanceInterventionLog(action: Omit<GovernanceAction, "id" | "result">) {
  await ensureInitialized()
  const entry: GovernanceAction = {
    id: `gov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...action,
    result: "applied",
  }

  actions.push(entry)
  if (actions.length > 5000) {
    actions = actions.slice(-5000)
  }
  await appendFile(ACTIONS_FILE, `${JSON.stringify(entry)}\n`, "utf8")
  return entry
}

export async function listGovernanceActions(
  options?: {
    userId?: string
    limit?: number
    minTimestamp?: number
  },
) {
  await ensureInitialized()
  let filtered = actions
  if (options?.userId) {
    filtered = filtered.filter((a) => a.userId === options.userId)
  }
  if (options?.minTimestamp) {
    filtered = filtered.filter((a) => a.timestamp >= options.minTimestamp)
  }
  return filtered
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, options?.limit || 200)
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
