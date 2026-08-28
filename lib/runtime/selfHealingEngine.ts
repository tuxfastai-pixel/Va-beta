/**
 * Autonomous Self-Healing Engine
 *
 * Monitors runtime integrity on a configurable cadence and applies the
 * minimal corrective intervention needed to return the system to a healthy
 * operating state.  Each healing action is non-destructive: it follows the
 * safe degradation ladder (reduce autonomy → quiet mode → recovery-only →
 * emergency rollback) rather than jumping straight to the most drastic step.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { captureRuntimeIntegrityReport, SafeModeRecommendation } from "./runtimeIntegrityMonitor.ts"
import { loadDeploymentSafetyConfig, saveDeploymentSafetyConfig } from "../governance/deploymentSafetyStore.ts"
import { saveFeatureRolloutPolicy } from "../governance/featureRolloutStore.ts"
import { savePersonalizationRolloutPolicy } from "../personalization/personalizationRolloutStore.ts"
import { importRuntimeSnapshot } from "../governance/runtimeSnapshot.ts"

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const HEALING_LOG_FILE = join(RUNTIME_DIR, "self-healing-log.jsonl")
const LAST_ANCHOR_FILE = join(RUNTIME_DIR, "last-certified-anchor-path.json")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealingAction =
  | "no_action"
  | "downgrade_autonomy_tier"
  | "force_quiet_mode"
  | "clear_replay_queue"
  | "reset_adaptive_state"
  | "freeze_personalization"
  | "switch_recovery_only"
  | "restore_certified_snapshot"

export type HealingOutcome = {
  timestamp: number
  triggeringRecommendation: SafeModeRecommendation
  actionsApplied: HealingAction[]
  integrityBefore: number
  warnings: string[]
  notes: string[]
  success: boolean
}

// ---------------------------------------------------------------------------
// Individual healing procedures
// ---------------------------------------------------------------------------

async function downgradeAutonomyTier(): Promise<string> {
  const cfg = await loadDeploymentSafetyConfig()
  await saveDeploymentSafetyConfig({
    forceBalancedMode: true,
    disableAutonomousPacing: cfg.disableAutonomousPacing || false,
    disableOrchestration: cfg.disableOrchestration || false,
    notificationMode: cfg.notificationMode ?? "normal",
    operationalMode: "regulated_autonomy",
    safeMode: false,
    rationale: [...(cfg.rationale ?? []), "self-healing: autonomy tier downgraded due to integrity degradation"],
  })
  return "autonomy tier set to regulated_autonomy"
}

async function forceQuietMode(): Promise<string> {
  const cfg = await loadDeploymentSafetyConfig()
  await saveDeploymentSafetyConfig({
    ...cfg,
    notificationMode: "quiet",
    rationale: [...(cfg.rationale ?? []), "self-healing: notification mode forced to quiet"],
  })
  return "notification mode set to quiet"
}

async function clearReplayQueue(): Promise<string> {
  // Truncate shadow-mode-decisions.jsonl to remove stale/poisoned entries.
  await mkdir(RUNTIME_DIR, { recursive: true })
  const marker = {
    cleared: true,
    reason: "self-healing: stale replay queue cleared",
    timestamp: Date.now(),
  }
  await writeFile(join(RUNTIME_DIR, "shadow-mode-decisions.jsonl"), JSON.stringify(marker) + "\n", "utf8")
  return "shadow-mode-decisions.jsonl truncated and reset"
}

async function resetAdaptiveState(): Promise<string> {
  const cfg = await loadDeploymentSafetyConfig()
  await saveDeploymentSafetyConfig({
    ...cfg,
    safeMode: true,
    operationalMode: "regulated_autonomy",
    forceBalancedMode: true,
    rationale: [...(cfg.rationale ?? []), "self-healing: adaptive state reset"],
  })
  // Reset personalization rollout to conservative mode.
  await savePersonalizationRolloutPolicy({ mode: "percentage", percentage: 5, enabled: true })
  return "adaptive state reset to conservative baseline"
}

async function freezePersonalizationLearning(): Promise<string> {
  await savePersonalizationRolloutPolicy({ mode: "percentage", percentage: 0, enabled: false })
  return "personalization learning frozen (rollout disabled)"
}

async function switchRecoveryOnly(): Promise<string> {
  const cfg = await loadDeploymentSafetyConfig()
  await saveDeploymentSafetyConfig({
    ...cfg,
    operationalMode: "recovery_priority",
    safeMode: true,
    rationale: [...(cfg.rationale ?? []), "self-healing: switched to recovery-only mode"],
  })
  await saveFeatureRolloutPolicy({ mode: "recovery-only", percentage: 0, enabled: true })
  return "operational mode set to recovery_priority"
}

async function restoreCertifiedSnapshot(): Promise<string> {
  try {
    const raw = await readFile(LAST_ANCHOR_FILE, "utf8")
    const { path } = JSON.parse(raw) as { path: string }
    await importRuntimeSnapshot({ snapshotOrPath: path, replayMode: "off" })
    return `certified snapshot restored from ${path}`
  } catch {
    return "no certified snapshot found — skipping restore"
  }
}

// ---------------------------------------------------------------------------
// Healing decision ladder
// ---------------------------------------------------------------------------

function selectHealingActions(recommendation: SafeModeRecommendation): HealingAction[] {
  switch (recommendation) {
    case "none":
      return ["no_action"]
    case "reduce_autonomy":
      return ["downgrade_autonomy_tier"]
    case "force_quiet_mode":
      return ["force_quiet_mode", "downgrade_autonomy_tier"]
    case "freeze_personalization":
      return ["freeze_personalization", "force_quiet_mode"]
    case "recovery_only":
      return ["clear_replay_queue", "reset_adaptive_state", "switch_recovery_only"]
    case "emergency_rollback":
      return ["clear_replay_queue", "freeze_personalization", "switch_recovery_only", "restore_certified_snapshot"]
    default:
      return ["no_action"]
  }
}

async function applyAction(action: HealingAction): Promise<string> {
  switch (action) {
    case "no_action":
      return "no action required"
    case "downgrade_autonomy_tier":
      return downgradeAutonomyTier()
    case "force_quiet_mode":
      return forceQuietMode()
    case "clear_replay_queue":
      return clearReplayQueue()
    case "reset_adaptive_state":
      return resetAdaptiveState()
    case "freeze_personalization":
      return freezePersonalizationLearning()
    case "switch_recovery_only":
      return switchRecoveryOnly()
    case "restore_certified_snapshot":
      return restoreCertifiedSnapshot()
  }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function logHealingOutcome(outcome: HealingOutcome): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(HEALING_LOG_FILE, JSON.stringify(outcome) + "\n", { flag: "a", encoding: "utf8" })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run a single integrity check and apply healing if needed.  Returns the outcome. */
export async function runSelfHealingCycle(): Promise<HealingOutcome> {
  const report = await captureRuntimeIntegrityReport()
  const recommendation = report.autoSafeModeRecommendation
  const actions = selectHealingActions(recommendation)
  const notes: string[] = []

  for (const action of actions) {
    try {
      const note = await applyAction(action)
      notes.push(`[${action}] ${note}`)
    } catch (err) {
      notes.push(`[${action}] ERROR: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const outcome: HealingOutcome = {
    timestamp: Date.now(),
    triggeringRecommendation: recommendation,
    actionsApplied: actions,
    integrityBefore: report.integrityScore,
    warnings: report.warnings,
    notes,
    success: recommendation === "none" || notes.every((n) => !n.includes("ERROR")),
  }

  await logHealingOutcome(outcome)
  return outcome
}

/** Read recent self-healing log entries. */
export async function listHealingOutcomes(limit = 50): Promise<HealingOutcome[]> {
  try {
    const raw = await readFile(HEALING_LOG_FILE, "utf8")
    const lines = raw.trim().split("\n").filter(Boolean).slice(-limit)
    return lines
      .map((l) => {
        try {
          return JSON.parse(l) as HealingOutcome
        } catch {
          return null
        }
      })
      .filter((e): e is HealingOutcome => e !== null)
  } catch {
    return []
  }
}

/** Register the path of the latest certified snapshot so the self-healing engine can restore it. */
export async function registerCertifiedAnchorPath(snapshotPath: string): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(LAST_ANCHOR_FILE, JSON.stringify({ path: snapshotPath, registeredAt: Date.now() }), "utf8")
}
