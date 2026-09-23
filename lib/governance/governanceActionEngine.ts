import { applyDeploymentSafety, type DeploymentSafetyOutcome } from "./deploymentSafety.ts"
import { loadDeploymentSafetyConfig, saveDeploymentSafetyConfig } from "./deploymentSafetyStore.ts"
import { loadPersonalizationRolloutPolicy, savePersonalizationRolloutPolicy } from "../personalization/personalizationRolloutStore.ts"
import { loadPersonalizationStates, savePersonalizationStates } from "../personalization/personalizationStore.ts"
import { appendEquilibriumEvent } from "../telemetry/equilibriumEventStream.ts"
import { logGovernanceIntervention } from "./governanceInterventionLog.ts"

export type GovernanceAction =
  | "freeze_personalization"
  | "force_balanced_mode"
  | "trigger_recovery_mode"
  | "reduce_adaptation_intensity"
  | "reset_rhythm_learning"
  | "revert_equilibrium_profile"
  | "suppress_proactive_adaptation"
  | "lock_workspace_mode"
  | "rollback_workspace"
  | "emergency_safe_mode"
  | "disable_orchestration"
  | "disable_pacing"
  | "force_quiet_notifications"

export type GovernanceActionInput = {
  action: GovernanceAction
  actor: string
  rationale: string
  source: string
  userId?: string | null
}

export type GovernanceActionResult = {
  intervention: Awaited<ReturnType<typeof logGovernanceIntervention>>
  config: Awaited<ReturnType<typeof loadDeploymentSafetyConfig>>
  personalizationRolloutPolicy: Awaited<ReturnType<typeof loadPersonalizationRolloutPolicy>>
  stateMutation: Record<string, unknown> | null
  telemetryEvent: Awaited<ReturnType<typeof appendEquilibriumEvent>>
  uiState: DeploymentSafetyOutcome
  calmMessage: string
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function buildNeutralHourlyRhythm() {
  return Array.from({ length: 24 }).map((_, hour) => ({
    hour,
    accelerationScore: 0.5,
    fatigueScore: 0.5,
    disengagementScore: 0.5,
    recoveryScore: 0.5,
  }))
}

function calmMessageForAction(action: GovernanceAction): string {
  if (action === "trigger_recovery_mode" || action === "emergency_safe_mode") {
    return "We detected strain and shifted to a calm recovery mode to protect continuity."
  }

  if (action === "rollback_workspace" || action === "revert_equilibrium_profile") {
    return "We restored a stable workspace baseline so you can continue without disruption."
  }

  if (action === "force_quiet_notifications") {
    return "Notifications have been quieted to reduce cognitive pressure and keep focus steady."
  }

  if (action === "freeze_personalization") {
    return "Personalization learning is temporarily frozen to keep behavior stable and predictable."
  }

  return "A stabilization intervention was applied to preserve continuity and reduce overload."
}

export async function applyGovernanceAction(input: GovernanceActionInput): Promise<GovernanceActionResult> {
  const action = input.action
  const userId = input.userId?.trim() || null

  const currentConfig = await loadDeploymentSafetyConfig()
  const currentRollout = await loadPersonalizationRolloutPolicy()

  let nextConfig = currentConfig
  let nextRollout = currentRollout
  let stateMutation: Record<string, unknown> | null = null

  if (action === "freeze_personalization") {
    nextRollout = await savePersonalizationRolloutPolicy({ enabled: false })
  }

  if (action === "force_balanced_mode") {
    nextConfig = await saveDeploymentSafetyConfig({
      forceBalancedMode: true,
      safeMode: false,
      reason: input.rationale,
      updatedAt: new Date(),
    })
  }

  if (action === "trigger_recovery_mode" || action === "emergency_safe_mode") {
    nextConfig = await saveDeploymentSafetyConfig({
      safeMode: true,
      forceBalancedMode: true,
      forceQuietNotifications: true,
      disableAutonomousPacing: true,
      disableOrchestration: true,
      reason: input.rationale,
      updatedAt: new Date(),
    })
  }

  if (action === "reduce_adaptation_intensity" || action === "disable_pacing") {
    nextConfig = await saveDeploymentSafetyConfig({
      disableAutonomousPacing: true,
      forceBalancedMode: true,
      reason: input.rationale,
      updatedAt: new Date(),
    })
  }

  if (action === "suppress_proactive_adaptation" || action === "disable_orchestration") {
    nextConfig = await saveDeploymentSafetyConfig({
      disableOrchestration: true,
      reason: input.rationale,
      updatedAt: new Date(),
    })
  }

  if (action === "lock_workspace_mode") {
    nextConfig = await saveDeploymentSafetyConfig({
      disableAdaptiveWorkspace: true,
      forceBalancedMode: true,
      reason: input.rationale,
      updatedAt: new Date(),
    })
  }

  if (action === "force_quiet_notifications") {
    nextConfig = await saveDeploymentSafetyConfig({
      forceQuietNotifications: true,
      reason: input.rationale,
      updatedAt: new Date(),
    })
  }

  if (action === "rollback_workspace") {
    nextConfig = await saveDeploymentSafetyConfig({
      disableAdaptiveWorkspace: true,
      forceBalancedMode: true,
      emergencyRollback: true,
      reason: input.rationale,
      updatedAt: new Date(),
    })
  }

  if (action === "reset_rhythm_learning" || action === "revert_equilibrium_profile" || action === "rollback_workspace") {
    const allStates = await loadPersonalizationStates()
    const targetIds = userId ? [userId] : Object.keys(allStates)

    for (const targetId of targetIds) {
      const targetState = allStates[targetId]
      if (!targetState) {
        continue
      }

      if (action === "reset_rhythm_learning") {
        targetState.rhythm = {
          hourlyProfile: buildNeutralHourlyRhythm(),
          accelerationWindows: [],
          fatigueWindows: [],
          disengagementWindows: [],
          bestRecoveryWindows: [],
          learnedAt: Date.now(),
        }
      }

      if (action === "revert_equilibrium_profile" || action === "rollback_workspace") {
        targetState.identity = {
          ...targetState.identity,
          pacingStyle: "adaptive",
          continuityStyle: "anchor-driven",
          workspaceTolerance: "balanced",
          adaptationConfidence: clamp01(targetState.identity.adaptationConfidence * 0.8),
          fingerprint: `rollback-${Date.now().toString(16)}-${targetState.identity.fingerprint.slice(0, 8)}`,
          createdAt: Date.now(),
        }
      }

      targetState.updatedAt = Date.now()
    }

    await savePersonalizationStates(allStates)
    stateMutation = {
      action,
      targetUserCount: targetIds.length,
    }
  }

  const intervention = await logGovernanceIntervention({
    actor: input.actor,
    action,
    rationale: input.rationale,
    metadata: {
      userId,
      source: input.source,
    },
  })

  const telemetryEvent = await appendEquilibriumEvent({
    userId: userId || "governance-global",
    eventType: "governance_action",
    previousState: "unknown",
    nextState: nextConfig.safeMode ? "recovery" : nextConfig.forceBalancedMode ? "balanced" : "stabilizing",
    pressureLevel: nextConfig.forceBalancedMode ? 0.5 : 0.6,
    fatigueRisk: nextConfig.safeMode ? 0.65 : 0.4,
    recoveryTriggered: nextConfig.safeMode,
    metadata: {
      action,
      actor: input.actor,
      source: input.source,
      rationale: input.rationale,
      interventionId: intervention.id,
    },
  })

  const uiState = applyDeploymentSafety("accelerated", nextConfig)

  return {
    intervention,
    config: nextConfig,
    personalizationRolloutPolicy: nextRollout,
    stateMutation,
    telemetryEvent,
    uiState,
    calmMessage: calmMessageForAction(action),
  }
}
