/**
 * Explainable AI Governance Report
 *
 * For every adaptive action the system takes, emits a structured report that
 * explains to humans (users, operators, regulators):
 *   - why the action happened
 *   - what signals triggered it
 *   - what was prevented
 *   - why pacing changed
 *   - why autonomy adjusted
 *   - why notifications slowed
 *   - why recovery activated
 *
 * Builds on the existing ExplainabilityEngine and DecisionProvenance chain
 * to produce enterprise-compatible audit reports.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"

import { explainGovernanceDecision } from "./explainabilityEngine.ts"
import type { ExplainabilityInput } from "./explainabilityEngine.ts"
import { listDecisionProvenance } from "./decisionProvenance.ts"
import type { GovernanceDecisionProvenance } from "./decisionProvenance.ts"

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const REPORT_DIR = join(RUNTIME_DIR, "explainability-reports")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdaptiveActionCategory =
  | "pacing_change"
  | "autonomy_adjustment"
  | "notification_slowdown"
  | "recovery_activation"
  | "workspace_simplification"
  | "rollback_triggered"
  | "trust_safeguard"
  | "governance_freeze"

export type ExplainableGovernanceReport = {
  reportId: string
  generatedAt: number
  userId: string
  actionCategory: AdaptiveActionCategory
  actionDescription: string
  // The "why" — human-readable narrative.
  whyItHappened: string
  whySignals: string[]          // what signals crossed thresholds
  whatWasPrevented: string
  whyPacingChanged: string | null
  whyAutonomyAdjusted: string | null
  whyNotificationsSlowed: string | null
  whyRecoveryActivated: string | null
  // Technical provenance.
  provenanceId: string | null
  triggeringSignals: GovernanceDecisionProvenance["originatingSignals"]
  confidenceScore: number
  // Audience-specific explanations.
  userFacingExplanation: string
  operatorExplanation: string
  regulatoryNarrative: string
}

// ---------------------------------------------------------------------------
// Narrative builders
// ---------------------------------------------------------------------------

function buildWhyPacingChanged(provenance: GovernanceDecisionProvenance | null, category: AdaptiveActionCategory): string | null {
  if (category !== "pacing_change" && !provenance?.action.includes("pacing")) return null
  if (!provenance) return "Pacing was adjusted based on accumulated fatigue signals."

  const fatigue = provenance.fatigueInputs
  const currentFatigueEstimate = Number(fatigue.currentFatigueEstimate)
  const dismissalPressure = Number(fatigue.dismissalPressure)
  if (currentFatigueEstimate > 0.7) {
    return `Pacing reduced because estimated fatigue reached ${(currentFatigueEstimate * 100).toFixed(0)}% - above the 70% intervention threshold.`
  }
  if (dismissalPressure > 0.5) {
    return `Pacing reduced because notification dismissal pressure (${(dismissalPressure * 100).toFixed(0)}%) suggests active disengagement.`
  }
  return "Pacing adjusted to maintain sustainable interaction cadence."
}

function buildWhyAutonomyAdjusted(provenance: GovernanceDecisionProvenance | null, category: AdaptiveActionCategory): string | null {
  if (category !== "autonomy_adjustment") return null
  if (!provenance) return "Autonomy was adjusted based on trust and drift signals."

  const trust = provenance.trustInputs
  const trustMomentum = Number(trust.trustMomentum)
  if (trust.trustRegime === "guarded") {
    return `Autonomy reduced because trust regime is 'guarded' (momentum: ${trustMomentum.toFixed(2)}). System requires human oversight before escalating.`
  }
  if (trustMomentum < -0.1) {
    return `Autonomy reduced due to negative trust momentum (${trustMomentum.toFixed(2)}), indicating declining user confidence.`
  }
  return "Autonomy tier was recalibrated to match current trust level."
}

function buildWhyNotificationsSlowed(provenance: GovernanceDecisionProvenance | null, category: AdaptiveActionCategory): string | null {
  if (category !== "notification_slowdown") return null
  if (!provenance) return "Notifications slowed to reduce interruption pressure."

  const fatigue = provenance.fatigueInputs
  const dismissalPressure = Number(fatigue.dismissalPressure)
  if (fatigue.notificationOverload) {
    return "Notifications paused because the system detected an active notification overload — continued delivery would degrade focus and trust."
  }
  if (dismissalPressure > 0.6) {
    return `Notification cadence reduced because dismissal rate (${(dismissalPressure * 100).toFixed(0)}%) exceeds sustainable threshold.`
  }
  return "Notification cadence slowed to preserve cognitive capacity."
}

function buildWhyRecoveryActivated(provenance: GovernanceDecisionProvenance | null, category: AdaptiveActionCategory): string | null {
  if (category !== "recovery_activation") return null
  if (!provenance) return "Recovery mode activated to support user wellbeing."

  const trust = provenance.trustInputs
  const fatigue = provenance.fatigueInputs
  const reasons: string[] = []
  const currentFatigueEstimate = Number(fatigue.currentFatigueEstimate)
  const trustMomentum = Number(trust.trustMomentum)

  if (currentFatigueEstimate > 0.8) reasons.push(`extreme fatigue (${(currentFatigueEstimate * 100).toFixed(0)}%)`)
  if (trust.trustRegime === "guarded") reasons.push("guarded trust regime")
  if (trustMomentum < -0.15) reasons.push("negative trust momentum")

  if (reasons.length === 0) return "Recovery activated as a precautionary measure."
  return `Recovery activated due to: ${reasons.join(", ")}. System entered supportive mode to allow restoration before resuming adaptive operations.`
}

function buildRegulatoryNarrative(report: Omit<ExplainableGovernanceReport, "regulatoryNarrative">): string {
  return [
    `[GOVERNANCE ACTION LOG] Report ID: ${report.reportId}`,
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    `User: ${report.userId}`,
    `Action: ${report.actionCategory} — ${report.actionDescription}`,
    `Confidence: ${(report.confidenceScore * 100).toFixed(1)}%`,
    `Provenance chain ID: ${report.provenanceId ?? "none"}`,
    "",
    "WHY THIS HAPPENED:",
    report.whyItHappened,
    "",
    "TRIGGERING SIGNALS:",
    ...report.whySignals.map((s) => `  • ${s}`),
    "",
    "WHAT WAS PREVENTED:",
    report.whatWasPrevented,
    "",
    "OPERATOR CONTEXT:",
    report.operatorExplanation,
  ].join("\n")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ExplainableReportInput = {
  userId: string
  actionCategory: AdaptiveActionCategory
  actionDescription: string
  provenanceId?: string
  explainabilityInput: ExplainabilityInput
  whatWasPrevented: string
}

export async function generateExplainableGovernanceReport(input: ExplainableReportInput): Promise<ExplainableGovernanceReport> {
  // Pull provenance record if available.
  let provenance: GovernanceDecisionProvenance | null = null
  if (input.provenanceId) {
    const records = await listDecisionProvenance({ userId: input.userId, limit: 500 })
    provenance = records.find((r) => r.id === input.provenanceId) ?? null
  }

  // Get structured explainability output from the existing engine.
  const explained = explainGovernanceDecision(input.explainabilityInput)

  const whySignals = input.explainabilityInput.factors.map((f) => {
    const label = f.label ?? f.key
    return typeof f.value === "number"
      ? `${label}: ${(f.value as number).toFixed ? (f.value as number).toFixed(3) : f.value}`
      : `${label}: ${f.value}`
  })

  const reportId = randomUUID()
  const now = Date.now()

  const partialReport = {
    reportId,
    generatedAt: now,
    userId: input.userId,
    actionCategory: input.actionCategory,
    actionDescription: input.actionDescription,
    whyItHappened: explained.summary,
    whySignals,
    whatWasPrevented: input.whatWasPrevented,
    whyPacingChanged: buildWhyPacingChanged(provenance, input.actionCategory),
    whyAutonomyAdjusted: buildWhyAutonomyAdjusted(provenance, input.actionCategory),
    whyNotificationsSlowed: buildWhyNotificationsSlowed(provenance, input.actionCategory),
    whyRecoveryActivated: buildWhyRecoveryActivated(provenance, input.actionCategory),
    provenanceId: input.provenanceId ?? null,
    triggeringSignals: provenance?.originatingSignals ?? {},
    confidenceScore: provenance?.confidenceScore ?? 0.5,
    userFacingExplanation: explained.calmUserExplanation,
    operatorExplanation: explained.operatorExplanation,
  }

  const regulatoryNarrative = buildRegulatoryNarrative(partialReport)
  const report: ExplainableGovernanceReport = { ...partialReport, regulatoryNarrative }

  // Persist to disk.
  await mkdir(REPORT_DIR, { recursive: true })
  await writeFile(
    join(REPORT_DIR, `${reportId}.json`),
    JSON.stringify(report, null, 2),
    "utf8",
  )

  return report
}

/** List recent explainability reports for a user. */
export async function listExplainableReports(userId: string, limit = 20): Promise<ExplainableGovernanceReport[]> {
  const records = await listDecisionProvenance({ userId, limit: limit * 2 })
  if (records.length === 0) return []

  // Attempt to load corresponding report files.
  const reports: ExplainableGovernanceReport[] = []
  for (const record of records.slice(0, limit)) {
    const candidates = [join(REPORT_DIR, `${record.id}.json`)]
    for (const path of candidates) {
      try {
        const raw = await readFile(path, "utf8")
        const r = JSON.parse(raw) as ExplainableGovernanceReport
        if (r.userId === userId) {
          reports.push(r)
          break
        }
      } catch {
        // File doesn't exist yet — that's fine.
      }
    }
  }

  return reports
}
