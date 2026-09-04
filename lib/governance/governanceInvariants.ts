import type { AdaptiveAutonomyStage } from "../autonomy/adaptivePermissionBoundary.ts"

export type GovernanceInvariantId =
  | "never_increase_pressure_during_recovery"
  | "never_accelerate_after_trust_decline"
  | "never_aggressive_workspace_mutation_after_rollback"
  | "never_exceed_cognitive_budget_in_stabilization"
  | "never_suppress_critical_continuity_events"

export type GovernanceInvariantViolation = {
  id: GovernanceInvariantId
  message: string
  severity: "high" | "medium"
}

export type GovernanceInvariantContext = {
  proposedAction: string
  currentAutonomyStage: AdaptiveAutonomyStage
  targetAutonomyStage: AdaptiveAutonomyStage
  inRecoveryMode: boolean
  inStabilizationMode: boolean
  trustMomentum: number
  recentRollbackAt?: number | null
  cognitiveBudgetRemaining?: number | null
  suppressCriticalContinuityEvents?: boolean
}

export type GovernanceInvariantResult = {
  violations: GovernanceInvariantViolation[]
  enforcedAction: string
  enforcedAutonomyStage: AdaptiveAutonomyStage
  suppressCriticalContinuityEvents: boolean
}

const STAGE_ORDER: AdaptiveAutonomyStage[] = [
  "recommendations_only",
  "passive_adaptation",
  "autonomous_pacing",
  "autonomous_workspace_restructuring",
]

function toStageIndex(stage: AdaptiveAutonomyStage): number {
  return STAGE_ORDER.indexOf(stage)
}

function isAggressiveAction(action: string): boolean {
  return action === "send_proposals" || action === "execute_tasks" || action === "optimize_earnings"
}

function isWorkspaceAggressiveStage(stage: AdaptiveAutonomyStage): boolean {
  return stage === "autonomous_workspace_restructuring"
}

export function enforceGovernanceInvariants(context: GovernanceInvariantContext): GovernanceInvariantResult {
  const violations: GovernanceInvariantViolation[] = []

  let enforcedAction = context.proposedAction
  let enforcedAutonomyStage = context.targetAutonomyStage
  let suppressCriticalContinuityEvents = Boolean(context.suppressCriticalContinuityEvents)

  if (context.inRecoveryMode && isAggressiveAction(enforcedAction)) {
    violations.push({
      id: "never_increase_pressure_during_recovery",
      message: "Recovery mode cannot increase pressure through aggressive autonomous actions",
      severity: "high",
    })
    enforcedAction = "awaiting_user_action"
    enforcedAutonomyStage = "recommendations_only"
  }

  if (context.trustMomentum < -0.05 && toStageIndex(enforcedAutonomyStage) > toStageIndex(context.currentAutonomyStage)) {
    violations.push({
      id: "never_accelerate_after_trust_decline",
      message: "Autonomy acceleration is blocked while trust momentum is declining",
      severity: "high",
    })
    enforcedAutonomyStage = context.currentAutonomyStage
  }

  const rollbackAgeMs = context.recentRollbackAt ? Date.now() - context.recentRollbackAt : null
  if (rollbackAgeMs !== null && rollbackAgeMs <= 24 * 60 * 60 * 1000 && isWorkspaceAggressiveStage(enforcedAutonomyStage)) {
    violations.push({
      id: "never_aggressive_workspace_mutation_after_rollback",
      message: "Workspace restructuring is blocked shortly after rollback events",
      severity: "high",
    })
    enforcedAutonomyStage = "passive_adaptation"
  }

  if (context.inStabilizationMode && (context.cognitiveBudgetRemaining ?? 1) < 0.35 && isAggressiveAction(enforcedAction)) {
    violations.push({
      id: "never_exceed_cognitive_budget_in_stabilization",
      message: "Aggressive actions are blocked when cognitive budget is low during stabilization",
      severity: "medium",
    })
    enforcedAction = "manual_review_required"
  }

  if (suppressCriticalContinuityEvents) {
    violations.push({
      id: "never_suppress_critical_continuity_events",
      message: "Critical continuity events must always remain visible",
      severity: "high",
    })
    suppressCriticalContinuityEvents = false
  }

  return {
    violations,
    enforcedAction,
    enforcedAutonomyStage,
    suppressCriticalContinuityEvents,
  }
}
