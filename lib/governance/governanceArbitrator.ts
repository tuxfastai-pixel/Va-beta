import type { AdaptiveAutonomyStage, AdaptivePermissionBoundary } from "../autonomy/adaptivePermissionBoundary.ts"
import { canExecuteActionWithinBoundary, getRequiredAutonomyStageForAction } from "../autonomy/adaptivePermissionBoundary.ts"
import type { AutonomyConfidenceScore } from "../autonomy/autonomyConfidence.ts"
import type { TrustAwareRollbackPrediction } from "../autonomy/trustAwareRollbackPrediction.ts"
import { enforceGovernanceInvariants, type GovernanceInvariantResult } from "./governanceInvariants.ts"
import type { OperationalGovernanceMode } from "./deploymentSafety.ts"
import type { SystemPressureState } from "../ui/notificationOrchestrator.ts"

export type GovernanceArbitrationAuthority =
  | "shadow-mode"
  | "trust-regulation"
  | "permission-boundary"
  | "rollback-risk"
  | "confidence"
  | "rollout-mode"
  | "runtime-integrity"
  | "invariant"

export type GovernanceArbitratorRuntimeSignal = {
  integrityScore: number
  runtimePressure: number
  degradationClassification: "healthy" | "degraded" | "critical" | "failing"
  autoSafeModeRecommendation: "none" | "reduce_autonomy" | "force_quiet_mode" | "freeze_personalization" | "recovery_only" | "emergency_rollback"
}

export type GovernanceArbitratorInput = {
  proposedAction: string
  trustRecommendedAction: string
  shadowModeActive: boolean
  trustRegime: "guarded" | "balanced" | "progressive"
  trustMomentum: number
  notificationPressureState: SystemPressureState
  permissionBoundary: AdaptivePermissionBoundary
  rollbackPrediction: TrustAwareRollbackPrediction
  autonomyConfidence: AutonomyConfidenceScore
  operationalMode?: OperationalGovernanceMode
  recentRollbackAt?: number | null
  cognitiveBudgetRemaining?: number | null
  suppressCriticalContinuityEvents?: boolean
  runtimeSignal?: GovernanceArbitratorRuntimeSignal | null
}

export type GovernanceArbitrationResult = {
  resolvedAction: string
  resolvedAutonomyStage: AdaptiveAutonomyStage
  finalAuthoritySource: GovernanceArbitrationAuthority
  authorityTrace: GovernanceArbitrationAuthority[]
  reasons: string[]
  invariants: GovernanceInvariantResult
  autoSafeModeRecommended: boolean
}

function applyRolloutModeConstraint(action: string, mode: OperationalGovernanceMode | undefined): string {
  if (mode === "shadow_only") {
    return "awaiting_user_action"
  }

  if (mode === "assistive_only") {
    return action === "manual_review_required" ? action : "manual_review_required"
  }

  if (mode === "recovery_priority") {
    return "awaiting_user_action"
  }

  return action
}

function applyRuntimeIntegrityConstraint(
  action: string,
  runtimeSignal: GovernanceArbitratorRuntimeSignal | null | undefined,
): { action: string; changed: boolean; reason?: string } {
  if (!runtimeSignal) {
    return { action, changed: false }
  }

  if (runtimeSignal.degradationClassification === "failing" || runtimeSignal.autoSafeModeRecommendation === "emergency_rollback") {
    return {
      action: "awaiting_user_action",
      changed: action !== "awaiting_user_action",
      reason: "Runtime integrity failing; emergency rollback posture requires user-gated execution",
    }
  }

  if (runtimeSignal.degradationClassification === "critical" || runtimeSignal.autoSafeModeRecommendation === "recovery_only") {
    return {
      action: "awaiting_user_action",
      changed: action !== "awaiting_user_action",
      reason: "Runtime integrity critical; forcing recovery-only safe execution",
    }
  }

  if (runtimeSignal.autoSafeModeRecommendation === "reduce_autonomy") {
    return {
      action: action === "awaiting_user_action" ? action : "manual_review_required",
      changed: action !== "manual_review_required" && action !== "awaiting_user_action",
      reason: "Runtime integrity recommends reduced autonomy",
    }
  }

  return { action, changed: false }
}

export function arbitrateGovernanceDecision(input: GovernanceArbitratorInput): GovernanceArbitrationResult {
  const reasons: string[] = []
  const trace: GovernanceArbitrationAuthority[] = []

  let action = input.shadowModeActive ? input.proposedAction : input.trustRecommendedAction
  trace.push(input.shadowModeActive ? "shadow-mode" : "trust-regulation")

  if (!canExecuteActionWithinBoundary(input.permissionBoundary, action)) {
    action = "manual_review_required"
    trace.push("permission-boundary")
    reasons.push("Action exceeded adaptive permission boundary")
  }

  if (!input.shadowModeActive && input.rollbackPrediction.shouldThrottle) {
    action = input.rollbackPrediction.recommendedAction
    trace.push("rollback-risk")
    reasons.push(...input.rollbackPrediction.reasons)
  }

  if (!input.shadowModeActive && input.autonomyConfidence.authorityLevel === "shadow_only") {
    action = "awaiting_user_action"
    trace.push("confidence")
    reasons.push("Autonomy confidence requires shadow-only authority")
  } else if (
    !input.shadowModeActive &&
    input.autonomyConfidence.authorityLevel === "assistive" &&
    action !== "manual_review_required" &&
    action !== "awaiting_user_action"
  ) {
    action = "manual_review_required"
    trace.push("confidence")
    reasons.push("Autonomy confidence requires assistive review authority")
  }

  const runtimeConstraint = applyRuntimeIntegrityConstraint(action, input.runtimeSignal)
  if (runtimeConstraint.changed) {
    action = runtimeConstraint.action
    trace.push("runtime-integrity")
    if (runtimeConstraint.reason) {
      reasons.push(runtimeConstraint.reason)
    }
  }

  const rolloutConstrained = applyRolloutModeConstraint(action, input.operationalMode)
  if (rolloutConstrained !== action) {
    action = rolloutConstrained
    trace.push("rollout-mode")
    reasons.push(`Operational mode constraint applied: ${input.operationalMode ?? "regulated_autonomy"}`)
  }

  const inRecoveryMode =
    input.notificationPressureState === "recovery" ||
    input.trustRegime === "guarded" ||
    input.runtimeSignal?.degradationClassification === "critical" ||
    input.runtimeSignal?.degradationClassification === "failing"

  const inStabilizationMode =
    input.notificationPressureState === "stabilizing" ||
    input.runtimeSignal?.degradationClassification === "degraded"

  const targetStage = getRequiredAutonomyStageForAction(action)
  const invariants = enforceGovernanceInvariants({
    proposedAction: action,
    currentAutonomyStage: input.permissionBoundary.stage,
    targetAutonomyStage: targetStage,
    inRecoveryMode,
    inStabilizationMode,
    trustMomentum: input.trustMomentum,
    recentRollbackAt: input.recentRollbackAt ?? null,
    cognitiveBudgetRemaining: input.cognitiveBudgetRemaining ?? null,
    suppressCriticalContinuityEvents: input.suppressCriticalContinuityEvents,
  })

  action = invariants.enforcedAction
  if (invariants.violations.length > 0) {
    trace.push("invariant")
    reasons.push(...invariants.violations.map((violation) => violation.message))
  }

  const finalAuthoritySource = trace[trace.length - 1]

  return {
    resolvedAction: action,
    resolvedAutonomyStage: invariants.enforcedAutonomyStage,
    finalAuthoritySource,
    authorityTrace: trace,
    reasons,
    invariants,
    autoSafeModeRecommended:
      input.runtimeSignal?.degradationClassification === "critical" ||
      input.runtimeSignal?.degradationClassification === "failing" ||
      input.runtimeSignal?.autoSafeModeRecommendation === "recovery_only" ||
      input.runtimeSignal?.autoSafeModeRecommendation === "emergency_rollback",
  }
}