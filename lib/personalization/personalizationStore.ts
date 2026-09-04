import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { EquilibriumEvent } from "@/lib/telemetry/equilibriumEventStream"
import type { PersonalEquilibriumProfile } from "@/lib/personalization/equilibriumProfile"
import type { BehavioralRhythmLearning } from "@/lib/personalization/rhythmLearning"
import type { PersonalizedRecoveryProfile } from "@/lib/personalization/recoveryProfiles"
import type { AdaptiveTrustModel } from "@/lib/personalization/trustContinuity"
import type { EquilibriumIdentity } from "@/lib/personalization/equilibriumIdentity"
import { supabaseServer } from "@/lib/supabaseServer"

export type UserPersonalizationState = {
  userId: string
  eventHistory: EquilibriumEvent[]
  profile: PersonalEquilibriumProfile
  rhythm: BehavioralRhythmLearning
  recovery: PersonalizedRecoveryProfile
  trust: AdaptiveTrustModel
  identity: EquilibriumIdentity
  updatedAt: number
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const PERSONALIZATION_FILE = join(RUNTIME_DIR, "personalization-profiles.json")
const PERSONALIZATION_TABLE = "user_personalization_states"

type PersonalizationRow = {
  user_id: string
  state: unknown
  updated_at: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeRecord(
  raw: unknown,
): Record<string, UserPersonalizationState> {
  if (!isObject(raw)) {
    return {}
  }

  const entries = Object.entries(raw)
  const out: Record<string, UserPersonalizationState> = {}
  for (const [userId, value] of entries) {
    if (!isObject(value)) {
      continue
    }

    const eventHistory = Array.isArray(value.eventHistory)
      ? (value.eventHistory as EquilibriumEvent[])
      : []
    if (!value.profile || !value.rhythm || !value.recovery || !value.trust || !value.identity) {
      continue
    }

    out[userId] = {
      userId,
      eventHistory,
      profile: value.profile as PersonalEquilibriumProfile,
      rhythm: value.rhythm as BehavioralRhythmLearning,
      recovery: value.recovery as PersonalizedRecoveryProfile,
      trust: value.trust as AdaptiveTrustModel,
      identity: value.identity as EquilibriumIdentity,
      updatedAt: Number(value.updatedAt ?? Date.now()),
    }
  }

  return out
}

function isMissingPersonalizationTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(PERSONALIZATION_TABLE) && message.includes("could not find the table")
}

function toPersonalizationRow(state: UserPersonalizationState): PersonalizationRow {
  return {
    user_id: state.userId,
    state,
    updated_at: new Date(state.updatedAt).toISOString(),
  }
}

export async function loadPersonalizationStates(): Promise<Record<string, UserPersonalizationState>> {
  const { data, error } = await supabaseServer
    .from(PERSONALIZATION_TABLE)
    .select("user_id, state, updated_at")

  if (!error && Array.isArray(data)) {
    const records = Object.fromEntries(
      (data as PersonalizationRow[])
        .map((row) => {
          const normalized = normalizeRecord({ [row.user_id]: row.state })
          return [row.user_id, normalized[row.user_id]] as const
        })
        .filter((entry): entry is readonly [string, UserPersonalizationState] => Boolean(entry[1])),
    )

    return records
  }

  if (error && !isMissingPersonalizationTable(error)) {
    throw new Error(`Failed to load personalization states: ${error.message}`)
  }

  await mkdir(RUNTIME_DIR, { recursive: true })
  try {
    const raw = await readFile(PERSONALIZATION_FILE, "utf8")
    return normalizeRecord(JSON.parse(raw))
  } catch {
    return {}
  }
}

export async function savePersonalizationStates(
  states: Record<string, UserPersonalizationState>,
): Promise<void> {
  const rows = Object.values(states).map((state) => toPersonalizationRow(state))
  const { error } = await supabaseServer
    .from(PERSONALIZATION_TABLE)
    .upsert(rows, { onConflict: "user_id" })

  if (!error) {
    return
  }

  if (error && !isMissingPersonalizationTable(error)) {
    throw new Error(`Failed to persist personalization states: ${error.message}`)
  }

  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(PERSONALIZATION_FILE, JSON.stringify(states, null, 2), "utf8")
}

export async function getPersonalizationState(userId: string) {
  const states = await loadPersonalizationStates()
  return states[userId] ?? null
}

export async function listPersonalizationStates(limit = 200) {
  const states = await loadPersonalizationStates()
  return Object.values(states)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(1, limit))
}
