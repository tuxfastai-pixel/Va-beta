import type { DeploymentSafetyConfig } from "./deploymentSafety.ts"
import { mergeDeploymentSafetyConfig } from "./deploymentSafety.ts"
import type { EquilibriumAggregation } from "../telemetry/equilibriumAggregator.ts"

export type AutonomousRollbackDecision = {
  triggered: boolean
  reason: string
  nextConfig: DeploymentSafetyConfig
}

export function evaluateAutonomousRollback(
  aggregation: EquilibriumAggregation,
  currentConfig: DeploymentSafetyConfig,
): AutonomousRollbackDecision {
  const anomalyScore = aggregation.anomalies.length
  const highRisk =
    aggregation.metrics.sessionContinuityRetention < 0.45 ||
    aggregation.metrics.suppressionAccuracy < 0.45 ||
    aggregation.transitions.frequencyPerHour > 8

  if (!highRisk && anomalyScore < 2) {
    return {
      triggered: false,
      reason: "Telemetry is within acceptable equilibrium bounds.",
      nextConfig: currentConfig,
    }
  }

  const escalationReason = `Autonomous rollback triggered (anomalies=${anomalyScore}, transitions/hour=${aggregation.transitions.frequencyPerHour.toFixed(2)})`
  const nextConfig = mergeDeploymentSafetyConfig(currentConfig, {
    safeMode: anomalyScore >= 3,
    emergencyRollback: anomalyScore >= 4,
    forceBalancedMode: true,
    forceQuietNotifications: true,
    disableAutonomousPacing: true,
    reason: escalationReason,
    updatedAt: new Date(),
  })

  return {
    triggered: true,
    reason: escalationReason,
    nextConfig,
  }
}
