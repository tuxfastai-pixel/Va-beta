export type RolloutMode = "percentage" | "cohort" | "internal-only" | "recovery-only" | "shadow-mode"

export type FeatureRolloutPolicy = {
  featureKey: string
  enabled: boolean
  mode: RolloutMode
  percentage: number
  allowedCohorts: string[]
  internalUserIds: string[]
}

export type RolloutEvaluationContext = {
  userId: string
  cohort?: string
  isInternalUser?: boolean
  isInRecoveryMode?: boolean
}

export const DEFAULT_FEATURE_ROLLOUT_POLICY: FeatureRolloutPolicy = {
  featureKey: "equilibrium-telemetry-v1",
  enabled: true,
  mode: "percentage",
  percentage: 100,
  allowedCohorts: [],
  internalUserIds: [],
}

function deterministicPercentage(featureKey: string, userId: string): number {
  const source = `${featureKey}:${userId}`
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  }
  return hash % 100
}

export function isFeatureEnabledForUser(
  policy: FeatureRolloutPolicy,
  context: RolloutEvaluationContext,
): boolean {
  if (!policy.enabled) {
    return false
  }

  if (policy.internalUserIds.includes(context.userId) || context.isInternalUser) {
    return true
  }

  switch (policy.mode) {
    case "internal-only":
      return false
    case "shadow-mode":
      return false
    case "cohort":
      return Boolean(context.cohort && policy.allowedCohorts.includes(context.cohort))
    case "recovery-only":
      return Boolean(context.isInRecoveryMode)
    case "percentage":
    default:
      return deterministicPercentage(policy.featureKey, context.userId) < Math.max(0, Math.min(100, policy.percentage))
  }
}

export function isShadowModeForUser(
  policy: FeatureRolloutPolicy,
  context: RolloutEvaluationContext,
): boolean {
  if (!policy.enabled || policy.mode !== "shadow-mode") {
    return false
  }

  if (policy.internalUserIds.includes(context.userId) || context.isInternalUser) {
    return true
  }

  if (policy.allowedCohorts.length > 0) {
    return Boolean(context.cohort && policy.allowedCohorts.includes(context.cohort))
  }

  return deterministicPercentage(policy.featureKey, context.userId) < Math.max(0, Math.min(100, policy.percentage))
}
