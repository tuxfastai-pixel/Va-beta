import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { loadDeploymentSafetyConfig, saveDeploymentSafetyConfig } from "./deploymentSafetyStore.ts"
import { loadFeatureRolloutPolicy, saveFeatureRolloutPolicy } from "./featureRolloutStore.ts"

export type ProductionRolloutMode =
  | "internal"
  | "pilot"
  | "passive"
  | "adaptive"
  | "supervised-autonomous"
  | "full-autonomous"

export type ProductionRolloutState = {
  mode: ProductionRolloutMode
  cohortPercentage: number
  frozen: boolean
  reason: string | null
  updatedAt: number
}

export type ProductionRolloutMetrics = {
  trustScore: number
  trustMomentum: number
  continuityHealth: number
  anomalyRate: number
  rollbackRate: number
  recoverySuccess: number
}

export type ProductionRolloutDecision = {
  nextMode: ProductionRolloutMode
  freeze: boolean
  rollback: boolean
  reasons: string[]
  governancePatch: {
    operationalMode?: "shadow_only" | "assistive_only" | "regulated_autonomy" | "full_autonomy" | "recovery_priority"
    safeMode?: boolean
    forceBalancedMode?: boolean
    disableOrchestration?: boolean
    disableAutonomousPacing?: boolean
  }
  rolloutPatch: {
    enabled?: boolean
    mode?: "percentage" | "cohort" | "internal-only" | "recovery-only" | "shadow-mode"
    percentage?: number
  }
}

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const STORE_FILE = join(RUNTIME_DIR, "production-rollout-controller.json")

const DEFAULT_STATE: ProductionRolloutState = {
  mode: "internal",
  cohortPercentage: 5,
  frozen: false,
  reason: null,
  updatedAt: Date.now(),
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

function modeIndex(mode: ProductionRolloutMode): number {
  return ["internal", "pilot", "passive", "adaptive", "supervised-autonomous", "full-autonomous"].indexOf(mode)
}

function modeFromIndex(index: number): ProductionRolloutMode {
  const modes: ProductionRolloutMode[] = ["internal", "pilot", "passive", "adaptive", "supervised-autonomous", "full-autonomous"]
  const safeIndex = Math.max(0, Math.min(modes.length - 1, index))
  return modes[safeIndex]
}

function normalizeState(raw: unknown): ProductionRolloutState {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_STATE }
  }

  const source = raw as Record<string, unknown>
  const mode = source.mode
  const normalizedMode: ProductionRolloutMode =
    mode === "internal" ||
    mode === "pilot" ||
    mode === "passive" ||
    mode === "adaptive" ||
    mode === "supervised-autonomous" ||
    mode === "full-autonomous"
      ? mode
      : DEFAULT_STATE.mode

  return {
    mode: normalizedMode,
    cohortPercentage: clampPercentage(Number(source.cohortPercentage ?? DEFAULT_STATE.cohortPercentage)),
    frozen: Boolean(source.frozen ?? false),
    reason: typeof source.reason === "string" ? source.reason : null,
    updatedAt: Number(source.updatedAt ?? Date.now()),
  }
}

export async function loadProductionRolloutState(): Promise<ProductionRolloutState> {
  await mkdir(RUNTIME_DIR, { recursive: true })
  try {
    const raw = await readFile(STORE_FILE, "utf8")
    return normalizeState(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export async function saveProductionRolloutState(patch: Partial<ProductionRolloutState>): Promise<ProductionRolloutState> {
  const current = await loadProductionRolloutState()
  const next = normalizeState({
    ...current,
    ...patch,
    updatedAt: Date.now(),
  })

  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(next, null, 2), "utf8")
  return next
}

export function evaluateProductionRolloutDecision(input: {
  state: ProductionRolloutState
  metrics: ProductionRolloutMetrics
}): ProductionRolloutDecision {
  const reasons: string[] = []
  const metrics = input.metrics
  const trust = clamp01(metrics.trustScore)
  const continuity = clamp01(metrics.continuityHealth)
  const anomaly = clamp01(metrics.anomalyRate)
  const rollback = clamp01(metrics.rollbackRate)
  const recovery = clamp01(metrics.recoverySuccess)

  if (anomaly > 0.45 || rollback > 0.35) {
    reasons.push("Anomaly or rollback pressure exceeded safe threshold")
    return {
      nextMode: modeFromIndex(modeIndex(input.state.mode) - 1),
      freeze: true,
      rollback: true,
      governancePatch: {
        operationalMode: "recovery_priority",
        safeMode: true,
        forceBalancedMode: true,
        disableOrchestration: true,
      },
      rolloutPatch: {
        enabled: true,
        mode: "recovery-only",
        percentage: Math.max(5, input.state.cohortPercentage / 2),
      },
      reasons,
    }
  }

  if (trust < 0.55 || continuity < 0.55 || metrics.trustMomentum < -0.08) {
    reasons.push("Trust or continuity is not stable enough for autonomous expansion")
    return {
      nextMode: modeFromIndex(modeIndex(input.state.mode) - 1),
      freeze: false,
      rollback: false,
      governancePatch: {
        operationalMode: "assistive_only",
        forceBalancedMode: true,
        disableAutonomousPacing: true,
      },
      rolloutPatch: {
        enabled: true,
        mode: "shadow-mode",
        percentage: input.state.cohortPercentage,
      },
      reasons,
    }
  }

  if (trust >= 0.78 && continuity >= 0.76 && recovery >= 0.72 && anomaly < 0.2 && rollback < 0.12) {
    reasons.push("Trust, continuity, and recovery are healthy enough for promotion")
    return {
      nextMode: modeFromIndex(modeIndex(input.state.mode) + 1),
      freeze: false,
      rollback: false,
      governancePatch: {
        operationalMode: "regulated_autonomy",
        safeMode: false,
        forceBalancedMode: false,
        disableOrchestration: false,
        disableAutonomousPacing: false,
      },
      rolloutPatch: {
        enabled: true,
        mode: "percentage",
        percentage: Math.min(100, input.state.cohortPercentage + 15),
      },
      reasons,
    }
  }

  reasons.push("Holding mode while collecting more stable telemetry")
  return {
    nextMode: input.state.mode,
    freeze: false,
    rollback: false,
    governancePatch: {
      operationalMode: input.state.mode === "internal" || input.state.mode === "pilot" ? "assistive_only" : "regulated_autonomy",
    },
    rolloutPatch: {
      enabled: true,
      mode: input.state.mode === "internal" ? "internal-only" : "percentage",
      percentage: input.state.cohortPercentage,
    },
    reasons,
  }
}

export async function tickProductionRolloutController(metrics: ProductionRolloutMetrics): Promise<{
  state: ProductionRolloutState
  decision: ProductionRolloutDecision
}> {
  const state = await loadProductionRolloutState()
  const decision = evaluateProductionRolloutDecision({ state, metrics })

  const nextPercentage = decision.rolloutPatch.percentage ?? state.cohortPercentage
  const nextState = await saveProductionRolloutState({
    mode: decision.nextMode,
    frozen: decision.freeze,
    cohortPercentage: clampPercentage(nextPercentage),
    reason: decision.reasons.join(" | "),
  })

  await saveDeploymentSafetyConfig({
    ...decision.governancePatch,
    updatedAt: new Date(),
    reason: `production-rollout:${decision.nextMode}`,
  })

  const rollout = await loadFeatureRolloutPolicy()
  await saveFeatureRolloutPolicy({
    ...decision.rolloutPatch,
    percentage: decision.rolloutPatch.percentage ?? rollout.percentage,
  })

  return {
    state: nextState,
    decision,
  }
}
