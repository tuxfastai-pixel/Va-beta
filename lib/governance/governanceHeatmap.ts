import type { InvariantAuditEntry } from "./invariantAuditLog.ts"

export type GovernanceHeatmapZone = {
  zone: string
  score: number
  count: number
  summary: string
}

export type GovernanceHeatmap = {
  highInterventionZones: GovernanceHeatmapZone[]
  overloadClusters: GovernanceHeatmapZone[]
  recoveryHotspots: GovernanceHeatmapZone[]
  rollbackProneFlows: GovernanceHeatmapZone[]
  trustInstabilityRegions: GovernanceHeatmapZone[]
}

type GovernanceHeatmapInput = {
  users: Array<{
    userId: string
    interventionDensity: number
    trustVolatility: number
    rollbackProbability: number
    continuityConfidence: number
    recoveryActivationRate: number
    autonomyInstability: number
  }>
  invariantTimeline: InvariantAuditEntry[]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function zone(zone: string, score: number, count: number, summary: string): GovernanceHeatmapZone {
  return {
    zone,
    score: clamp01(score),
    count,
    summary,
  }
}

export function buildGovernanceHeatmap(input: GovernanceHeatmapInput): GovernanceHeatmap {
  const users = input.users
  const invariantCounts = input.invariantTimeline.reduce<Record<string, number>>((accumulator, item) => {
    const key = item.userId ?? "global"
    accumulator[key] = (accumulator[key] ?? 0) + 1
    return accumulator
  }, {})

  const interventionZones = users
    .filter((user) => user.interventionDensity >= 0.35)
    .sort((a, b) => b.interventionDensity - a.interventionDensity)
    .slice(0, 8)
    .map((user) =>
      zone(user.userId, user.interventionDensity, Math.round(user.interventionDensity * 100), "Intervention density is elevated"),
    )

  const overloadClusters = users
    .filter((user) => 1 - user.continuityConfidence >= 0.35)
    .sort((a, b) => (1 - b.continuityConfidence) - (1 - a.continuityConfidence))
    .slice(0, 8)
    .map((user) => zone(user.userId, 1 - user.continuityConfidence, Math.round((1 - user.continuityConfidence) * 100), "Continuity confidence is low"))

  const recoveryHotspots = users
    .filter((user) => user.recoveryActivationRate >= 0.3)
    .sort((a, b) => b.recoveryActivationRate - a.recoveryActivationRate)
    .slice(0, 8)
    .map((user) => zone(user.userId, user.recoveryActivationRate, Math.round(user.recoveryActivationRate * 100), "Recovery is activating frequently"))

  const rollbackProneFlows = users
    .filter((user) => user.rollbackProbability >= 0.4)
    .sort((a, b) => b.rollbackProbability - a.rollbackProbability)
    .slice(0, 8)
    .map((user) => zone(user.userId, user.rollbackProbability, Math.round(user.rollbackProbability * 100), "Rollback risk is elevated"))

  const trustInstabilityRegions = users
    .map((user) => ({ ...user, invariantCount: invariantCounts[user.userId] ?? 0 }))
    .filter((user) => user.trustVolatility >= 0.18 || user.autonomyInstability >= 0.3 || user.invariantCount > 0)
    .sort((a, b) => (b.trustVolatility + b.autonomyInstability) - (a.trustVolatility + a.autonomyInstability))
    .slice(0, 8)
    .map((user) =>
      zone(
        user.userId,
        user.trustVolatility * 0.6 + user.autonomyInstability * 0.4,
        user.invariantCount,
        user.invariantCount > 0 ? "Instability coincides with invariant enforcement" : "Trust and autonomy signals are oscillating",
      ),
    )

  return {
    highInterventionZones: interventionZones,
    overloadClusters,
    recoveryHotspots,
    rollbackProneFlows,
    trustInstabilityRegions,
  }
}
