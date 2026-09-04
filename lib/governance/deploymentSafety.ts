import type { SystemPressureState } from "../ui/notificationOrchestrator.ts"

export type NotificationSafetyMode = "normal" | "quiet"

export type OperationalGovernanceMode =
  | "shadow_only"
  | "assistive_only"
  | "regulated_autonomy"
  | "full_autonomy"
  | "recovery_priority"

export type DeploymentSafetyConfig = {
  disableAdaptiveWorkspace: boolean
  disableOrchestration: boolean
  disableAutonomousPacing: boolean
  forceBalancedMode: boolean
  forceQuietNotifications: boolean
  emergencyRollback: boolean
  safeMode: boolean
  operationalMode: OperationalGovernanceMode
  updatedAt: Date
  reason: string | null
}

export type DeploymentSafetyOutcome = {
  effectivePressureState: SystemPressureState
  workspaceAdaptiveEnabled: boolean
  orchestrationEnabled: boolean
  autonomousPacingEnabled: boolean
  notificationMode: NotificationSafetyMode
  isEmergencyGuardrailActive: boolean
  rationale: string[]
}

export const DEFAULT_DEPLOYMENT_SAFETY_CONFIG: DeploymentSafetyConfig = {
  disableAdaptiveWorkspace: false,
  disableOrchestration: false,
  disableAutonomousPacing: false,
  forceBalancedMode: false,
  forceQuietNotifications: false,
  emergencyRollback: false,
  safeMode: false,
  operationalMode: "regulated_autonomy",
  updatedAt: new Date(0),
  reason: null,
}

export function normalizeOperationalGovernanceMode(value: unknown): OperationalGovernanceMode {
  return value === "shadow_only" ||
    value === "assistive_only" ||
    value === "regulated_autonomy" ||
    value === "full_autonomy" ||
    value === "recovery_priority"
    ? value
    : "regulated_autonomy"
}

function patchForOperationalMode(mode: OperationalGovernanceMode): Partial<DeploymentSafetyConfig> {
  if (mode === "shadow_only") {
    return {
      disableAdaptiveWorkspace: true,
      disableAutonomousPacing: true,
      forceBalancedMode: true,
    }
  }

  if (mode === "assistive_only") {
    return {
      disableAdaptiveWorkspace: true,
      disableAutonomousPacing: true,
      forceQuietNotifications: false,
    }
  }

  if (mode === "recovery_priority") {
    return {
      disableAdaptiveWorkspace: true,
      disableAutonomousPacing: true,
      disableOrchestration: true,
      forceBalancedMode: true,
      forceQuietNotifications: true,
      safeMode: true,
    }
  }

  return {}
}

export function mergeDeploymentSafetyConfig(
  base: DeploymentSafetyConfig,
  partial: Partial<DeploymentSafetyConfig>,
): DeploymentSafetyConfig {
  return {
    ...base,
    ...partial,
    updatedAt: partial.updatedAt ?? new Date(),
  }
}

export function applyDeploymentSafety(
  currentPressureState: SystemPressureState,
  config: DeploymentSafetyConfig,
): DeploymentSafetyOutcome {
  const rationale: string[] = []
  const effectiveConfig = {
    ...config,
    ...patchForOperationalMode(config.operationalMode),
  }

  rationale.push(`Operational governance mode: ${effectiveConfig.operationalMode}`)

  const emergencyGuardrail = effectiveConfig.emergencyRollback || effectiveConfig.safeMode
  const forceBalanced = emergencyGuardrail || effectiveConfig.forceBalancedMode

  const effectivePressureState: SystemPressureState = forceBalanced ? "balanced" : currentPressureState
  if (forceBalanced) {
    rationale.push("Pressure state forced to balanced mode")
  }

  const workspaceAdaptiveEnabled = !(emergencyGuardrail || effectiveConfig.disableAdaptiveWorkspace)
  if (!workspaceAdaptiveEnabled) {
    rationale.push("Adaptive workspace disabled")
  }

  const orchestrationEnabled = !(emergencyGuardrail || effectiveConfig.disableOrchestration)
  if (!orchestrationEnabled) {
    rationale.push("Orchestration disabled")
  }

  const autonomousPacingEnabled = !(emergencyGuardrail || effectiveConfig.disableAutonomousPacing)
  if (!autonomousPacingEnabled) {
    rationale.push("Autonomous pacing disabled")
  }

  const notificationMode: NotificationSafetyMode =
    emergencyGuardrail || effectiveConfig.forceQuietNotifications ? "quiet" : "normal"
  if (notificationMode === "quiet") {
    rationale.push("Notifications forced to quiet mode")
  }

  if (effectiveConfig.reason) {
    rationale.push(`Operator reason: ${effectiveConfig.reason}`)
  }

  return {
    effectivePressureState,
    workspaceAdaptiveEnabled,
    orchestrationEnabled,
    autonomousPacingEnabled,
    notificationMode,
    isEmergencyGuardrailActive: emergencyGuardrail,
    rationale,
  }
}
