/**
 * Runtime Integrity Monitor
 *
 * The system's "nervous system health monitor."  Samples memory, telemetry
 * backlog, replay queue stalls, stuck recovery states, governance deadlocks,
 * notification flood risk, and shadow-mode drift to produce an integrity
 * score, runtime pressure rating, degradation classification, and an
 * auto-safe-mode recommendation that the self-healing engine can act on.
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"

const RUNTIME_DIR = join(process.cwd(), ".runtime")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrityClassification = "healthy" | "degraded" | "critical" | "failing"

export type SafeModeRecommendation =
  | "none"
  | "reduce_autonomy"
  | "force_quiet_mode"
  | "freeze_personalization"
  | "recovery_only"
  | "emergency_rollback"

export type RuntimeIntegritySignals = {
  heapUsedMb: number
  heapTotalMb: number
  memoryPressure: number        // 0-1
  telemetryBacklogSize: number  // line count of equilibrium events
  replayQueueStall: boolean
  shadowDriftCount: number
  invariantViolationCount: number
  provenanceChainLength: number
  recoveryStuckCount: number
  notificationFloodRisk: number // 0-1
  orchestrationLoopDepth: number
}

export type RuntimeIntegrityReport = {
  timestamp: number
  integrityScore: number           // 0-1, higher = healthier
  runtimePressure: number          // 0-1, higher = worse
  degradationClassification: IntegrityClassification
  autoSafeModeRecommendation: SafeModeRecommendation
  signals: RuntimeIntegritySignals
  warnings: string[]
  recommendations: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/** Count lines in a JSONL file as a proxy for backlog depth. */
async function countJsonlLines(filePath: string): Promise<number> {
  try {
    const raw = await readFile(filePath, "utf8")
    return raw.trim().split("\n").filter(Boolean).length
  } catch {
    return 0
  }
}

/** Read the last N lines of a JSONL to detect recent patterns. */
async function readLastJsonlLines(filePath: string, n: number): Promise<unknown[]> {
  try {
    const raw = await readFile(filePath, "utf8")
    const lines = raw.trim().split("\n").filter(Boolean).slice(-n)
    return lines.map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    }).filter(Boolean)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Signal Sampling
// ---------------------------------------------------------------------------

async function sampleMemoryPressure(): Promise<{ heapUsedMb: number; heapTotalMb: number; pressure: number }> {
  const mem = process.memoryUsage()
  const heapUsedMb = mem.heapUsed / 1_048_576
  const heapTotalMb = mem.heapTotal / 1_048_576
  // warn zone: >75 % of heap total
  const pressure = clamp01(heapUsedMb / Math.max(1, heapTotalMb))
  return { heapUsedMb, heapTotalMb, pressure }
}

async function sampleTelemetryBacklog(): Promise<number> {
  return countJsonlLines(join(RUNTIME_DIR, "equilibrium-events.jsonl"))
}

async function detectReplayQueueStall(): Promise<boolean> {
  // A stall is defined as >50 entries with no update in the last sampling window.
  const lines = await readLastJsonlLines(join(RUNTIME_DIR, "shadow-mode-decisions.jsonl"), 20)
  if (lines.length < 20) return false

  // If last 20 entries are all older than 5 min, flag a stall.
  const now = Date.now()
  const fiveMin = 5 * 60 * 1000
  const timestamps: number[] = lines
    .map((l) => {
      if (typeof l === "object" && l !== null && "timestamp" in l) {
        return Number((l as Record<string, unknown>).timestamp)
      }
      return 0
    })
    .filter((t) => t > 0)

  if (timestamps.length === 0) return false
  const newest = Math.max(...timestamps)
  return now - newest > fiveMin
}

async function sampleShadowDriftCount(): Promise<number> {
  const lines = await readLastJsonlLines(join(RUNTIME_DIR, "shadow-mode-decisions.jsonl"), 200)
  let diverged = 0
  for (const l of lines) {
    if (typeof l === "object" && l !== null) {
      const entry = l as Record<string, unknown>
      if (entry.diverged === true || entry.shadowDivergence === true) {
        diverged++
      }
    }
  }
  return diverged
}

async function sampleInvariantViolations(): Promise<number> {
  return countJsonlLines(join(RUNTIME_DIR, "invariant-audit-log.jsonl"))
}

async function sampleProvenanceChainLength(): Promise<number> {
  return countJsonlLines(join(RUNTIME_DIR, "decision-provenance.jsonl"))
}

async function detectRecoveryStuck(): Promise<number> {
  // Read deployment safety config and check how long recovery_priority has been set.
  try {
    const raw = await readFile(join(RUNTIME_DIR, "deployment-safety-config.json"), "utf8")
    const cfg = JSON.parse(raw) as Record<string, unknown>
    const mode = String(cfg.operationalMode ?? "")
    const updatedAt = Number(cfg.updatedAt ?? 0)
    if (mode === "recovery_priority" && Date.now() - updatedAt > 30 * 60 * 1000) {
      return 1 // stuck in recovery for >30 min
    }
    return 0
  } catch {
    return 0
  }
}

async function sampleNotificationFloodRisk(): Promise<number> {
  // Proxy: count recent equilibrium events that mention overload.
  const lines = await readLastJsonlLines(join(RUNTIME_DIR, "equilibrium-events.jsonl"), 50)
  let overloadCount = 0
  for (const l of lines) {
    if (typeof l === "object" && l !== null) {
      const entry = l as Record<string, unknown>
      const state = String(entry.state ?? entry.equilibriumState ?? "").toLowerCase()
      if (state.includes("overload") || state.includes("flood") || state.includes("storm")) {
        overloadCount++
      }
    }
  }
  return clamp01(overloadCount / 10)
}

// ---------------------------------------------------------------------------
// Score Computation
// ---------------------------------------------------------------------------

function computeRuntimePressure(signals: RuntimeIntegritySignals): number {
  const weights = {
    memoryPressure: 0.20,
    telemetryBacklog: 0.15,   // normalised against 500 lines
    replayStall: 0.10,
    shadowDrift: 0.10,        // normalised against 20 items
    invariantViolations: 0.15,// normalised against 50
    recoveryStuck: 0.10,
    notificationFlood: 0.10,
    orchestrationDepth: 0.10, // normalised against 10
  }

  const p =
    weights.memoryPressure * signals.memoryPressure +
    weights.telemetryBacklog * clamp01(signals.telemetryBacklogSize / 500) +
    weights.replayStall * (signals.replayQueueStall ? 1 : 0) +
    weights.shadowDrift * clamp01(signals.shadowDriftCount / 20) +
    weights.invariantViolations * clamp01(signals.invariantViolationCount / 50) +
    weights.recoveryStuck * clamp01(signals.recoveryStuckCount) +
    weights.notificationFlood * signals.notificationFloodRisk +
    weights.orchestrationDepth * clamp01(signals.orchestrationLoopDepth / 10)

  return clamp01(p)
}

function classify(pressure: number): IntegrityClassification {
  if (pressure < 0.25) return "healthy"
  if (pressure < 0.50) return "degraded"
  if (pressure < 0.75) return "critical"
  return "failing"
}

function recommend(classification: IntegrityClassification, signals: RuntimeIntegritySignals): SafeModeRecommendation {
  if (classification === "healthy") return "none"
  if (classification === "failing" || signals.recoveryStuckCount > 0) return "emergency_rollback"
  if (classification === "critical") {
    if (signals.replayQueueStall) return "recovery_only"
    return "reduce_autonomy"
  }
  // degraded
  if (signals.notificationFloodRisk > 0.5) return "force_quiet_mode"
  if (signals.telemetryBacklogSize > 200) return "freeze_personalization"
  return "reduce_autonomy"
}

function buildWarnings(signals: RuntimeIntegritySignals): string[] {
  const warnings: string[] = []
  if (signals.memoryPressure > 0.8) warnings.push(`Heap pressure critical: ${signals.heapUsedMb.toFixed(1)}MB / ${signals.heapTotalMb.toFixed(1)}MB`)
  if (signals.telemetryBacklogSize > 200) warnings.push(`Telemetry backlog: ${signals.telemetryBacklogSize} events pending`)
  if (signals.replayQueueStall) warnings.push("Replay queue stall detected — no recent shadow decisions")
  if (signals.shadowDriftCount > 10) warnings.push(`Shadow drift: ${signals.shadowDriftCount} diverged decisions`)
  if (signals.invariantViolationCount > 20) warnings.push(`Invariant violations accumulating: ${signals.invariantViolationCount} logged`)
  if (signals.recoveryStuckCount > 0) warnings.push("System stuck in recovery_priority mode for >30 min")
  if (signals.notificationFloodRisk > 0.5) warnings.push(`Notification flood risk: ${Math.round(signals.notificationFloodRisk * 100)}%`)
  if (signals.orchestrationLoopDepth > 5) warnings.push(`Orchestration loop depth ${signals.orchestrationLoopDepth} — possible runaway cycle`)
  return warnings
}

function buildRecommendations(classification: IntegrityClassification, signals: RuntimeIntegritySignals): string[] {
  const recs: string[] = []
  if (classification === "healthy") return recs
  if (signals.memoryPressure > 0.75) recs.push("Consider restarting orchestration slice to release heap")
  if (signals.telemetryBacklogSize > 200) recs.push("Freeze personalization learning to reduce write throughput")
  if (signals.replayQueueStall) recs.push("Clear poisoned replay queue entries and reinitialise shadow processor")
  if (signals.invariantViolationCount > 20) recs.push("Review invariant audit log — sustained violations suggest governance misconfiguration")
  if (signals.recoveryStuckCount > 0) recs.push("Force operational mode reset to 'regulated_autonomy' or restore certified snapshot")
  if (signals.notificationFloodRisk > 0.5) recs.push("Switch to quiet notification mode immediately")
  if (classification === "failing") recs.push("CRITICAL: Restore last certified rollback anchor snapshot")
  return recs
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let _orchestrationLoopDepth = 0

/** Increment / decrement the loop depth counter from orchestration code. */
export function trackOrchestrationLoopDepth(delta: 1 | -1): void {
  _orchestrationLoopDepth = Math.max(0, _orchestrationLoopDepth + delta)
}

export async function captureRuntimeIntegrityReport(): Promise<RuntimeIntegrityReport> {
  const [mem, telemetry, stall, shadow, invariants, provenance, recovery, flood] = await Promise.all([
    sampleMemoryPressure(),
    sampleTelemetryBacklog(),
    detectReplayQueueStall(),
    sampleShadowDriftCount(),
    sampleInvariantViolations(),
    sampleProvenanceChainLength(),
    detectRecoveryStuck(),
    sampleNotificationFloodRisk(),
  ])

  const signals: RuntimeIntegritySignals = {
    heapUsedMb: mem.heapUsedMb,
    heapTotalMb: mem.heapTotalMb,
    memoryPressure: mem.pressure,
    telemetryBacklogSize: telemetry,
    replayQueueStall: stall,
    shadowDriftCount: shadow,
    invariantViolationCount: invariants,
    provenanceChainLength: provenance,
    recoveryStuckCount: recovery,
    notificationFloodRisk: flood,
    orchestrationLoopDepth: _orchestrationLoopDepth,
  }

  const runtimePressure = computeRuntimePressure(signals)
  const integrityScore = clamp01(1 - runtimePressure)
  const degradationClassification = classify(runtimePressure)
  const autoSafeModeRecommendation = recommend(degradationClassification, signals)
  const warnings = buildWarnings(signals)
  const recommendations = buildRecommendations(degradationClassification, signals)

  return {
    timestamp: Date.now(),
    integrityScore,
    runtimePressure,
    degradationClassification,
    autoSafeModeRecommendation,
    signals,
    warnings,
    recommendations,
  }
}
