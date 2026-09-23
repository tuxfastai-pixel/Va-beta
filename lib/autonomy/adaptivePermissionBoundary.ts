import type { AutonomyProfile, AutonomyTier } from "./autonomyProfile.ts"

export type AdaptiveAutonomyStage =
  | "recommendations_only"
  | "passive_adaptation"
  | "autonomous_pacing"
  | "autonomous_workspace_restructuring"

export type AdaptivePermissionBoundary = {
  stage: AdaptiveAutonomyStage
  tier: AutonomyTier
  earned: boolean
  reasons: string[]
  grantedCapabilities: string[]
}

type BoundaryInputs = {
  profile: AutonomyProfile
  trustRegime: "guarded" | "balanced" | "progressive"
  trustMomentum: number
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

function clampStage(stage: AdaptiveAutonomyStage): AdaptiveAutonomyStage {
  const index = toStageIndex(stage)
  if (index <= 0) {
    return "recommendations_only"
  }
  if (index >= STAGE_ORDER.length - 1) {
    return "autonomous_workspace_restructuring"
  }
  return STAGE_ORDER[index]
}

function downgrade(stage: AdaptiveAutonomyStage): AdaptiveAutonomyStage {
  const index = Math.max(0, toStageIndex(stage) - 1)
  return STAGE_ORDER[index]
}

function capabilitiesForStage(stage: AdaptiveAutonomyStage): string[] {
  if (stage === "recommendations_only") {
    return ["recommendations"]
  }

  if (stage === "passive_adaptation") {
    return ["recommendations", "passive_adaptation"]
  }

  if (stage === "autonomous_pacing") {
    return ["recommendations", "passive_adaptation", "autonomous_pacing"]
  }

  return [
    "recommendations",
    "passive_adaptation",
    "autonomous_pacing",
    "autonomous_workspace_restructuring",
  ]
}

export function getRequiredAutonomyStageForAction(action: string): AdaptiveAutonomyStage {
  if (action === "find_jobs" || action === "build_profile" || action === "complete_platforms") {
    return "recommendations_only"
  }

  if (action === "send_proposals" || action === "reply_to_clients") {
    return "passive_adaptation"
  }

  if (action === "execute_tasks" || action === "optimize_earnings") {
    return "autonomous_pacing"
  }

  return "recommendations_only"
}

export function canExecuteActionWithinBoundary(boundary: AdaptivePermissionBoundary, action: string): boolean {
  return toStageIndex(boundary.stage) >= toStageIndex(getRequiredAutonomyStageForAction(action))
}

export function resolveAdaptivePermissionBoundary(input: BoundaryInputs): AdaptivePermissionBoundary {
  const reasons: string[] = []
  const { profile } = input

  let stage: AdaptiveAutonomyStage = "recommendations_only"

  if (profile.tier === "balanced") {
    stage = "passive_adaptation"
    reasons.push("Balanced autonomy profile allows passive adaptation")
  }

  if (profile.tier === "progressive") {
    stage = "autonomous_pacing"
    reasons.push("Progressive autonomy profile supports autonomous pacing")
  }

  if (profile.tier === "highly_autonomous") {
    stage = "autonomous_workspace_restructuring"
    reasons.push("Highly autonomous profile supports workspace restructuring")
  }

  if (input.trustRegime === "guarded") {
    stage = "recommendations_only"
    reasons.push("Guarded trust regime restricts autonomy to recommendations")
  }

  if (profile.continuityStability < 0.48 || profile.interventionAcceptance < 0.45) {
    stage = downgrade(stage)
    reasons.push("Continuity or intervention acceptance is not stable enough for current autonomy level")
  }

  if (profile.rollbackSensitivity > 0.66) {
    stage = downgrade(stage)
    reasons.push("Rollback sensitivity is elevated, so autonomy is softened")
  }

  if (input.trustMomentum < -0.08) {
    stage = downgrade(downgrade(stage))
    reasons.push("Recent trust decline prevents autonomy escalation")
  }

  stage = clampStage(stage)

  return {
    stage,
    tier: profile.tier,
    earned: stage !== "recommendations_only",
    reasons,
    grantedCapabilities: capabilitiesForStage(stage),
  }
}
