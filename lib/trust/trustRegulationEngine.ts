import {
  loadDeploymentSafetyConfig,
  saveDeploymentSafetyConfig,
} from "../governance/deploymentSafetyStore.ts"
import {
  loadPersonalizationRolloutPolicy,
  savePersonalizationRolloutPolicy,
} from "../personalization/personalizationRolloutStore.ts"
import type { DeploymentSafetyConfig } from "../governance/deploymentSafety.ts"
import type { FeatureRolloutPolicy } from "../governance/featureRollout.ts"
import type { TrustMetrics } from "./trustMetrics.ts"

export type TrustAutonomyLevel = "guarded" | "balanced" | "progressive"

export type TrustRegulationPlan = {
  autonomyLevel: TrustAutonomyLevel
  pacingIntensity: "reduced" | "normal" | "adaptive"
  transparencyMode: "elevated" | "standard" | "minimal"
  interventionSensitivity: "high" | "medium" | "low"
  notificationPolicy: "quiet" | "balanced" | "normal"
  automationThrottle: number
  reasons: string[]
  deploymentSafetyPatch: Partial<DeploymentSafetyConfig>
  rolloutPatch: Partial<FeatureRolloutPolicy>
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function computeRisk(metrics: TrustMetrics): number {
  const continuityRisk = 1 - clamp01(metrics.continuityTrustScore)
  const pacingRisk = 1 - clamp01(metrics.pacingRespectScore)
  const reliabilityRisk = 1 - clamp01(metrics.perceivedReliability)
  const interventionRisk = 1 - clamp01(metrics.interventionSupportScore)
  const comfortRisk = 1 - clamp01(metrics.adaptiveComfortIndex)

  return clamp01(
    continuityRisk * 0.24 +
      pacingRisk * 0.24 +
      reliabilityRisk * 0.2 +
      interventionRisk * 0.16 +
      comfortRisk * 0.16,
  )
}

export function buildTrustRegulationPlan(metrics: TrustMetrics): TrustRegulationPlan {
  const risk = computeRisk(metrics)
  const reasons: string[] = []

  if (metrics.continuityTrustScore < 0.5) {
    reasons.push("Low continuity trust requires conservative re-entry behavior")
  }
  if (metrics.pacingRespectScore < 0.5) {
    reasons.push("Pacing respect is weak, so pacing and notifications should be softened")
  }
  if (metrics.perceivedReliability < 0.55) {
    reasons.push("Reliability perception is degraded and needs stronger stability guardrails")
  }
  if (metrics.interventionSupportScore < 0.52) {
    reasons.push("Interventions are at risk of feeling controlling and need higher sensitivity")
  }
  if (metrics.adaptiveComfortIndex < 0.48) {
    reasons.push("Adaptive comfort is low, so automation must be throttled")
  }

  if (risk >= 0.65) {
    return {
      autonomyLevel: "guarded",
      pacingIntensity: "reduced",
      transparencyMode: "elevated",
      interventionSensitivity: "high",
      notificationPolicy: "quiet",
      automationThrottle: 0.2,
      reasons,
      deploymentSafetyPatch: {
        safeMode: true,
        forceBalancedMode: true,
        disableAutonomousPacing: true,
        disableOrchestration: true,
        forceQuietNotifications: true,
        disableAdaptiveWorkspace: true,
        reason: "trust-regulation-guarded",
        updatedAt: new Date(),
      },
      rolloutPatch: {
        enabled: true,
        mode: "recovery-only",
        percentage: 100,
      },
    }
  }

  if (risk >= 0.38) {
    return {
      autonomyLevel: "balanced",
      pacingIntensity: "normal",
      transparencyMode: "standard",
      interventionSensitivity: "medium",
      notificationPolicy: "balanced",
      automationThrottle: 0.55,
      reasons,
      deploymentSafetyPatch: {
        safeMode: false,
        emergencyRollback: false,
        forceBalancedMode: true,
        disableAutonomousPacing: false,
        disableOrchestration: false,
        forceQuietNotifications: true,
        disableAdaptiveWorkspace: false,
        reason: "trust-regulation-balanced",
        updatedAt: new Date(),
      },
      rolloutPatch: {
        enabled: true,
        mode: "percentage",
        percentage: 65,
      },
    }
  }

  return {
    autonomyLevel: "progressive",
    pacingIntensity: "adaptive",
    transparencyMode: "minimal",
    interventionSensitivity: "low",
    notificationPolicy: "normal",
    automationThrottle: 0.9,
    reasons,
    deploymentSafetyPatch: {
      safeMode: false,
      emergencyRollback: false,
      forceBalancedMode: false,
      disableAutonomousPacing: false,
      disableOrchestration: false,
      forceQuietNotifications: false,
      disableAdaptiveWorkspace: false,
      reason: "trust-regulation-progressive",
      updatedAt: new Date(),
    },
    rolloutPatch: {
      enabled: true,
      mode: "percentage",
      percentage: 100,
    },
  }
}

export async function applyTrustRegulationPlan(metrics: TrustMetrics): Promise<{
  plan: TrustRegulationPlan
  deploymentSafety: Awaited<ReturnType<typeof loadDeploymentSafetyConfig>>
  personalizationRollout: Awaited<ReturnType<typeof loadPersonalizationRolloutPolicy>>
}> {
  const plan = buildTrustRegulationPlan(metrics)

  const deploymentSafety = await saveDeploymentSafetyConfig(plan.deploymentSafetyPatch)
  const personalizationRollout = await savePersonalizationRolloutPolicy(plan.rolloutPatch)

  return {
    plan,
    deploymentSafety,
    personalizationRollout,
  }
}
