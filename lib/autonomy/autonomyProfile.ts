import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

export type AutonomyTier = "conservative" | "balanced" | "progressive" | "highly_autonomous"

export type AutonomyProfile = {
  userId: string
  automationComfort: number
  pacingTolerance: number
  workspaceFlexibility: number
  interruptionTolerance: number
  adaptationAcceptance: number
  rollbackSensitivity: number
  continuityStability: number
  interventionAcceptance: number
  recoveryResponsiveness: number
  tier: AutonomyTier
  updatedAt: number
}

type MutationOptions = {
  mutationKey?: string
}

type AutonomyProfileStoreState = {
  records: Record<string, AutonomyProfile>
}

type AutonomySignalInput = {
  automationComfort: number
  pacingTolerance: number
  workspaceFlexibility: number
  interruptionTolerance: number
  adaptationAcceptance: number
  rollbackSensitivity: number
  continuityStability: number
  interventionAcceptance: number
  recoveryResponsiveness: number
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const STORE_FILE = join(RUNTIME_DIR, "autonomy-profile-store.json")
const MUTATION_LEDGER_LIMIT = 800
const BLEND_FACTOR = 0.35

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5
  }
  return Math.max(0, Math.min(1, value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function blend(previous: number, next: number): number {
  return clamp01(previous * (1 - BLEND_FACTOR) + next * BLEND_FACTOR)
}

function normalizeTier(value: unknown): AutonomyTier {
  return value === "conservative" || value === "balanced" || value === "progressive" || value === "highly_autonomous"
    ? value
    : "balanced"
}

function defaultProfile(userId: string): AutonomyProfile {
  return {
    userId,
    automationComfort: 0.5,
    pacingTolerance: 0.5,
    workspaceFlexibility: 0.5,
    interruptionTolerance: 0.5,
    adaptationAcceptance: 0.5,
    rollbackSensitivity: 0.5,
    continuityStability: 0.5,
    interventionAcceptance: 0.5,
    recoveryResponsiveness: 0.5,
    tier: "balanced",
    updatedAt: Date.now(),
  }
}

function normalizeProfile(userId: string, value: unknown): AutonomyProfile {
  const source = isObject(value) ? value : {}
  const profile: AutonomyProfile = {
    userId,
    automationComfort: clamp01(Number(source.automationComfort ?? 0.5)),
    pacingTolerance: clamp01(Number(source.pacingTolerance ?? 0.5)),
    workspaceFlexibility: clamp01(Number(source.workspaceFlexibility ?? 0.5)),
    interruptionTolerance: clamp01(Number(source.interruptionTolerance ?? 0.5)),
    adaptationAcceptance: clamp01(Number(source.adaptationAcceptance ?? 0.5)),
    rollbackSensitivity: clamp01(Number(source.rollbackSensitivity ?? 0.5)),
    continuityStability: clamp01(Number(source.continuityStability ?? 0.5)),
    interventionAcceptance: clamp01(Number(source.interventionAcceptance ?? 0.5)),
    recoveryResponsiveness: clamp01(Number(source.recoveryResponsiveness ?? 0.5)),
    tier: normalizeTier(source.tier),
    updatedAt: Number(source.updatedAt ?? Date.now()),
  }

  return {
    ...profile,
    tier: deriveAutonomyTier(profile),
  }
}

function getLedger(profile: AutonomyProfile): string[] {
  const value = (profile as AutonomyProfile & { _ledger?: string[] })._ledger
  if (Array.isArray(value)) {
    return value
  }
  ;(profile as AutonomyProfile & { _ledger?: string[] })._ledger = []
  return (profile as AutonomyProfile & { _ledger?: string[] })._ledger as string[]
}

function trackMutation(profile: AutonomyProfile, mutationKey?: string): void {
  if (!mutationKey) {
    return
  }

  const ledger = getLedger(profile)
  if (ledger.includes(mutationKey)) {
    return
  }

  ledger.push(mutationKey)
  if (ledger.length > MUTATION_LEDGER_LIMIT) {
    ;(profile as AutonomyProfile & { _ledger?: string[] })._ledger = ledger.slice(-MUTATION_LEDGER_LIMIT)
  }
}

function isDuplicateMutation(profile: AutonomyProfile, mutationKey?: string): boolean {
  if (!mutationKey) {
    return false
  }
  return getLedger(profile).includes(mutationKey)
}

async function loadStore(): Promise<AutonomyProfileStoreState> {
  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const raw = await readFile(STORE_FILE, "utf8")
    const parsed = JSON.parse(raw) as { records?: Record<string, unknown> }
    const records: Record<string, AutonomyProfile> = {}

    for (const [userId, value] of Object.entries(parsed.records ?? {})) {
      records[userId] = normalizeProfile(userId, value)
    }

    return { records }
  } catch {
    return { records: {} }
  }
}

async function saveStore(state: AutonomyProfileStoreState): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(state, null, 2), "utf8")
}

function ensureProfile(state: AutonomyProfileStoreState, userId: string): AutonomyProfile {
  if (!state.records[userId]) {
    state.records[userId] = defaultProfile(userId)
  }
  return state.records[userId]
}

export function deriveAutonomyTier(profile: AutonomyProfile): AutonomyTier {
  if (
    profile.rollbackSensitivity >= 0.78 ||
    profile.automationComfort <= 0.35 ||
    profile.continuityStability <= 0.35 ||
    profile.interventionAcceptance <= 0.32
  ) {
    return "conservative"
  }

  const confidenceScore =
    profile.automationComfort * 0.2 +
    profile.pacingTolerance * 0.16 +
    profile.workspaceFlexibility * 0.12 +
    profile.interruptionTolerance * 0.1 +
    profile.adaptationAcceptance * 0.14 +
    (1 - profile.rollbackSensitivity) * 0.14 +
    profile.continuityStability * 0.08 +
    profile.interventionAcceptance * 0.03 +
    profile.recoveryResponsiveness * 0.03

  if (confidenceScore < 0.5) {
    return "conservative"
  }
  if (confidenceScore < 0.7) {
    return "balanced"
  }
  if (confidenceScore < 0.85) {
    return "progressive"
  }
  return "highly_autonomous"
}

export async function loadAutonomyProfile(userId: string): Promise<AutonomyProfile> {
  const state = await loadStore()
  return ensureProfile(state, userId)
}

export async function listAutonomyProfiles(limit = 200): Promise<AutonomyProfile[]> {
  const state = await loadStore()
  return Object.values(state.records)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(1, limit))
}

export async function learnAutonomyProfile(
  userId: string,
  signals: AutonomySignalInput,
  options: MutationOptions = {},
): Promise<AutonomyProfile> {
  const state = await loadStore()
  const profile = ensureProfile(state, userId)

  if (isDuplicateMutation(profile, options.mutationKey)) {
    return profile
  }

  profile.automationComfort = blend(profile.automationComfort, signals.automationComfort)
  profile.pacingTolerance = blend(profile.pacingTolerance, signals.pacingTolerance)
  profile.workspaceFlexibility = blend(profile.workspaceFlexibility, signals.workspaceFlexibility)
  profile.interruptionTolerance = blend(profile.interruptionTolerance, signals.interruptionTolerance)
  profile.adaptationAcceptance = blend(profile.adaptationAcceptance, signals.adaptationAcceptance)
  profile.rollbackSensitivity = blend(profile.rollbackSensitivity, signals.rollbackSensitivity)
  profile.continuityStability = blend(profile.continuityStability, signals.continuityStability)
  profile.interventionAcceptance = blend(profile.interventionAcceptance, signals.interventionAcceptance)
  profile.recoveryResponsiveness = blend(profile.recoveryResponsiveness, signals.recoveryResponsiveness)
  profile.tier = deriveAutonomyTier(profile)
  profile.updatedAt = Date.now()

  trackMutation(profile, options.mutationKey)
  await saveStore(state)
  return profile
}

export function summarizeAutonomyProfile(profile: AutonomyProfile) {
  return {
    userId: profile.userId,
    tier: profile.tier,
    automationComfort: profile.automationComfort,
    pacingTolerance: profile.pacingTolerance,
    workspaceFlexibility: profile.workspaceFlexibility,
    interruptionTolerance: profile.interruptionTolerance,
    adaptationAcceptance: profile.adaptationAcceptance,
    rollbackSensitivity: profile.rollbackSensitivity,
    continuityStability: profile.continuityStability,
    interventionAcceptance: profile.interventionAcceptance,
    recoveryResponsiveness: profile.recoveryResponsiveness,
    updatedAt: profile.updatedAt,
  }
}