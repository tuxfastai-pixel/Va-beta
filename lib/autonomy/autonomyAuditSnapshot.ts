import { loadSessionContinuityRecord } from "../continuity/sessionContinuityStore.ts"
import { loadDeploymentSafetyConfig } from "../governance/deploymentSafetyStore.ts"
import { buildGovernanceHeatmap } from "../governance/governanceHeatmap.ts"
import { enforceGovernanceInvariants } from "../governance/governanceInvariants.ts"
import { listInvariantAuditEntries } from "../governance/invariantAuditLog.ts"
import { listShadowModeDecisions } from "../governance/shadowModeDecisionLog.ts"
import { listTrustHistoryRecords, loadTrustHistoryRecord, summarizeTrustHistory } from "../trust/trustHistoryStore.ts"
import { forecastAdaptiveRisk } from "./adaptiveRiskForecast.ts"
import { listAutonomyProfiles, loadAutonomyProfile, summarizeAutonomyProfile } from "./autonomyProfile.ts"
import { scoreAutonomyConfidence } from "./autonomyConfidence.ts"
import { resolveAdaptivePermissionBoundary } from "./adaptivePermissionBoundary.ts"
import { summarizeInterventionAcceptance } from "./interventionAcceptanceLearning.ts"
import { summarizeRecoveryEffectiveness } from "./recoveryEffectivenessLearning.ts"
import { predictTrustAwareRollback } from "./trustAwareRollbackPrediction.ts"

type TrustSummary = ReturnType<typeof summarizeTrustHistory>
type AutonomySummary = ReturnType<typeof summarizeAutonomyProfile>
type BoundarySummary = ReturnType<typeof resolveAdaptivePermissionBoundary>
type RecoverySummary = ReturnType<typeof summarizeRecoveryEffectiveness>
type InterventionSummary = ReturnType<typeof summarizeInterventionAcceptance>
type RollbackPrediction = ReturnType<typeof predictTrustAwareRollback>
type RiskForecast = ReturnType<typeof forecastAdaptiveRisk>
type ConfidenceScore = ReturnType<typeof scoreAutonomyConfidence>
type InvariantResult = ReturnType<typeof enforceGovernanceInvariants>
type InvariantEntry = Awaited<ReturnType<typeof listInvariantAuditEntries>>[number]
type ShadowEntry = Awaited<ReturnType<typeof listShadowModeDecisions>>[number]

export type AutonomyStateColor = "stable" | "watch" | "critical"

export type AutonomyAuditDecisionReplayItem = {
  id: string
  timestamp: number
  userId: string
  decision: string
  reason: string
  predictedBenefit: {
    fatigueReduction: number
    trustStabilityGain: number
  }
  predictedTrustImpact: number
  actualObservedOutcome: {
    fatigueOutcome: "improved" | "unchanged" | "worsened"
    trustOutcome: "improved" | "unchanged" | "worsened"
    rollbackOutcome: "avoided" | "unknown" | "triggered"
    recoveryOutcome: "improved" | "unchanged" | "worsened"
  }
  source: "shadow" | "live"
}

export type InvariantTimelineItem = {
  id: string
  timestamp: number
  userId: string | null
  invariantId: InvariantEntry["invariantId"]
  affectedAction: string
  resultingAction: string
  overridePossible: boolean
  severity: InvariantEntry["severity"]
  context: Record<string, unknown>
}

export type ShadowLiveDivergenceSummary = {
  totalShadowDecisions: number
  totalLiveDecisionsObserved: number
  divergenceRate: number
  trustOutcomeDelta: number
  fatigueOutcomeDelta: number
  recoveryOutcomeDelta: number
  rollbackOutcomeDelta: number
}

export type RecoveryEffectivenessPanel = {
  byUser: Array<{
    userId: string
    tier: AutonomySummary["tier"]
    bestStrategies: string[]
    failedStrategies: string[]
    fatigueRecoveryLeaders: string[]
    trustRecoveryLeaders: string[]
    rollbackPreventionLeaders: string[]
    pacingStabilizationLeaders: string[]
  }>
  byTier: Array<{
    tier: AutonomySummary["tier"]
    bestStrategies: string[]
    failedStrategies: string[]
  }>
}

export type AutonomyAuditItem = {
  userId: string
  autonomyTier: AutonomySummary["tier"]
  permissionBoundaryStage: BoundarySummary["stage"]
  trustRegime: TrustSummary["trustRegime"]
  trustMomentum: number
  continuityConfidence: number
  adaptiveComfort: number
  interventionAcceptanceScore: number
  currentConstraints: {
    activeThrottles: string[]
    pacingModifiers: string[]
    deniedActions: string[]
    throttledActions: string[]
    shadowOnlyDecisions: string[]
    rollbackRecommendations: string[]
    currentRegulationState: string
  }
  rollbackRisk: number
  trustDisruptionProbability: number
  interruptionCost: number
  governanceEnforcement: {
    invariantViolations: InvariantResult["violations"]
    deniedActions: string[]
    throttledActions: string[]
    shadowOnlyDecisions: string[]
    rollbackRecommendations: string[]
  }
  recoveryEffectiveness: {
    topSuccessfulRecoveryStrategies: string[]
    failedStrategies: string[]
    recoveryStabilizationLatency: number
  }
  behavioralDriftIndicators: {
    trustVolatility: number
    autonomyInstability: number
    regulationFrequency: number
    interventionDensity: number
  }
  autonomyConfidence: ConfidenceScore
  adaptiveRiskForecast: RiskForecast
  pacingState: "fragile" | "steady" | "adaptive"
  stabilityColor: AutonomyStateColor
  updatedAt: number
}

export type AutonomyAuditSnapshot = {
  generatedAt: string
  filters: {
    userId: string | null
    tier: string | null
  }
  globalPosture: {
    operationalMode: Awaited<ReturnType<typeof loadDeploymentSafetyConfig>>["operationalMode"]
    safeMode: boolean
    forceBalancedMode: boolean
    quietNotifications: boolean
  }
  systemAutonomyHealth: {
    activeAutonomyTiers: Record<AutonomySummary["tier"], number>
    throttledUsers: number
    rollbackRiskDistribution: {
      low: number
      medium: number
      high: number
    }
    invariantInterventionRate: number
    recoveryActivationRate: number
    shadowModeDivergence: number
  }
  userStabilityGrid: AutonomyAuditItem[]
  invariantViolationsTimeline: InvariantTimelineItem[]
  autonomyDecisionReplay: AutonomyAuditDecisionReplayItem[]
  shadowLiveDivergence: ShadowLiveDivergenceSummary
  governanceHeatmap: ReturnType<typeof buildGovernanceHeatmap>
  recoveryIntelligenceEffectiveness: RecoveryEffectivenessPanel
  items: AutonomyAuditItem[]
  status: "ok"
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function proposedActionForStage(stage: BoundarySummary["stage"]): string {
  if (stage === "recommendations_only") {
    return "find_jobs"
  }
  if (stage === "passive_adaptation") {
    return "send_proposals"
  }
  if (stage === "autonomous_workspace_restructuring") {
    return "optimize_earnings"
  }
  return "execute_tasks"
}

function continuityConfidenceFromRecord(
  continuityRecord: Awaited<ReturnType<typeof loadSessionContinuityRecord>> | null,
  autonomy: AutonomySummary,
): number {
  const recoveryWindow = continuityRecord?.equilibriumRecoveryHistory.slice(-12) ?? []
  if (recoveryWindow.length <= 0) {
    return autonomy.continuityStability
  }
  return clamp01(average(recoveryWindow.map((entry) => entry.confidence)))
}

function trustVolatility(summary: TrustSummary): number {
  const windows = summary.latestMetrics ? [summary.latestMetrics.compositeTrustScore] : []
  const driftSignal = summary.driftAlerts.length / 10
  const momentumSignal = Math.min(1, Math.abs(summary.trustMomentum) * 4)
  return clamp01(average([...windows, driftSignal, momentumSignal]))
}

function autonomyInstability(autonomy: AutonomySummary, rollbackPrediction: RollbackPrediction): number {
  return clamp01(
    rollbackPrediction.rollbackProbability * 0.36 +
      rollbackPrediction.trustDisruptionProbability * 0.24 +
      autonomy.rollbackSensitivity * 0.22 +
      (1 - autonomy.adaptationAcceptance) * 0.18,
  )
}

function regulationFrequency(invariantEntries: InvariantEntry[], shadowEntries: ShadowEntry[]): number {
  return clamp01((invariantEntries.length + shadowEntries.length) / 20)
}

function interventionDensity(interventionSummary: InterventionSummary): number {
  const patterns = interventionSummary.patterns
  if (patterns.length <= 0) {
    return 0
  }
  return clamp01(patterns.reduce((sum, pattern) => sum + pattern.total, 0) / 40)
}

function pacingState(autonomy: AutonomySummary): "fragile" | "steady" | "adaptive" {
  if (autonomy.pacingTolerance < 0.45) {
    return "fragile"
  }
  if (autonomy.pacingTolerance < 0.72) {
    return "steady"
  }
  return "adaptive"
}

function stabilityColorFromSignals(input: {
  rollbackRisk: number
  continuityConfidence: number
  trustVolatility: number
}): AutonomyStateColor {
  if (input.rollbackRisk >= 0.6 || input.continuityConfidence < 0.45 || input.trustVolatility >= 0.55) {
    return "critical"
  }
  if (input.rollbackRisk >= 0.35 || input.continuityConfidence < 0.68 || input.trustVolatility >= 0.25) {
    return "watch"
  }
  return "stable"
}

function currentRegulationState(input: {
  boundary: BoundarySummary
  rollbackPrediction: RollbackPrediction
  confidence: ConfidenceScore
  operationalMode: string
}): string {
  if (input.operationalMode === "shadow_only") {
    return "shadow_only"
  }
  if (input.operationalMode === "assistive_only") {
    return "assistive_only"
  }
  if (input.rollbackPrediction.shouldThrottle) {
    return "throttled"
  }
  if (input.confidence.authorityLevel === "shadow_only") {
    return "shadow_only"
  }
  if (input.confidence.authorityLevel === "assistive") {
    return "assistive"
  }
  if (input.boundary.stage === "recommendations_only") {
    return "recommendations_only"
  }
  return "autonomous"
}

function failedStrategies(summary: RecoverySummary): string[] {
  return summary.strategies
    .filter((strategy) => strategy.successRate < 0.45 || strategy.effectivenessScore < 0.45)
    .map((strategy) => strategy.strategy)
    .slice(0, 5)
}

function recoveryLatency(continuityRecord: Awaited<ReturnType<typeof loadSessionContinuityRecord>> | null): number {
  const history = continuityRecord?.equilibriumRecoveryHistory.slice(-20) ?? []
  if (history.length < 2) {
    return 0
  }

  let totalLatency = 0
  let pairs = 0
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1]
    const current = history[index]
    if (previous.strategy === current.strategy) {
      totalLatency += Math.max(0, current.timestamp - previous.timestamp)
      pairs += 1
    }
  }

  return pairs > 0 ? Math.round(totalLatency / pairs) : 0
}

function parseDecisionPayload(entry: ShadowEntry): Record<string, unknown> {
  try {
    const parsed = JSON.parse(entry.decision) as Record<string, unknown>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function decisionReason(entry: ShadowEntry): string {
  const metadata = entry.metadata ?? {}
  const reasons = Array.isArray(metadata.reasons) ? metadata.reasons.map((value) => String(value)) : []
  if (reasons.length > 0) {
    return reasons.join(" | ")
  }
  const trustRegime = typeof metadata.trustRegime === "string" ? metadata.trustRegime : null
  if (trustRegime) {
    return `Decision evaluated under ${trustRegime} trust regime`
  }
  return "No detailed reason captured"
}

function actualOutcome(entry: ShadowEntry): AutonomyAuditDecisionReplayItem["actualObservedOutcome"] {
  return {
    fatigueOutcome: entry.actualOutcome?.fatigueActuallyRose ? "worsened" : entry.actualOutcome ? "improved" : "unchanged",
    trustOutcome: entry.actualOutcome?.trustActuallyDropped ? "worsened" : entry.actualOutcome ? "improved" : "unchanged",
    rollbackOutcome: entry.actualOutcome?.trustActuallyDropped || entry.actualOutcome?.fatigueActuallyRose ? "triggered" : entry.actualOutcome ? "avoided" : "unknown",
    recoveryOutcome: entry.actualOutcome?.fatigueActuallyRose ? "worsened" : entry.actualOutcome ? "improved" : "unchanged",
  }
}

function buildDecisionReplay(entries: ShadowEntry[]): AutonomyAuditDecisionReplayItem[] {
  return entries.slice(0, 40).map((entry) => {
    const payload = parseDecisionPayload(entry)
    const decision = typeof payload.wouldApply === "string"
      ? payload.wouldApply
      : typeof payload.observedAction === "string"
        ? payload.observedAction
        : entry.decision

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      userId: entry.userId,
      decision,
      reason: decisionReason(entry),
      predictedBenefit: {
        fatigueReduction: entry.expectedBenefit.expectedFatigueReduction,
        trustStabilityGain: entry.expectedBenefit.expectedTrustStabilityGain,
      },
      predictedTrustImpact: entry.expectedBenefit.expectedTrustStabilityGain,
      actualObservedOutcome: actualOutcome(entry),
      source: "shadow",
    }
  })
}

function buildInvariantTimeline(entries: InvariantEntry[]): InvariantTimelineItem[] {
  return entries.slice(0, 60).map((entry) => ({
    id: entry.id,
    timestamp: entry.timestamp,
    userId: entry.userId,
    invariantId: entry.invariantId,
    affectedAction: entry.blockedAction,
    resultingAction: entry.downstreamActionTaken,
    overridePossible: entry.severity !== "high",
    severity: entry.severity,
    context: entry.context,
  }))
}

function buildShadowLiveDivergence(entries: ShadowEntry[]): ShadowLiveDivergenceSummary {
  const liveObserved = entries.filter((entry) => {
    const payload = parseDecisionPayload(entry)
    return typeof payload.observedAction === "string"
  })

  const divergent = liveObserved.filter((entry) => {
    const payload = parseDecisionPayload(entry)
    return payload.wouldApply !== payload.observedAction
  })

  const trustDelta = average(
    divergent.map((entry) => (entry.actualOutcome?.trustActuallyDropped ? -1 : 1)),
  )
  const fatigueDelta = average(
    divergent.map((entry) => (entry.actualOutcome?.fatigueActuallyRose ? -1 : 1)),
  )

  return {
    totalShadowDecisions: entries.length,
    totalLiveDecisionsObserved: liveObserved.length,
    divergenceRate: entries.length > 0 ? divergent.length / entries.length : 0,
    trustOutcomeDelta: clamp01((trustDelta + 1) / 2),
    fatigueOutcomeDelta: clamp01((fatigueDelta + 1) / 2),
    recoveryOutcomeDelta: clamp01((fatigueDelta + trustDelta + 2) / 4),
    rollbackOutcomeDelta: clamp01(1 - average(divergent.map((entry) => (entry.actualOutcome?.trustActuallyDropped ? 1 : 0)))),
  }
}

function buildRecoveryPanel(items: AutonomyAuditItem[]): RecoveryEffectivenessPanel {
  const byTierMap = new Map<AutonomySummary["tier"], { best: string[]; failed: string[] }>()
  for (const item of items) {
    const current = byTierMap.get(item.autonomyTier) ?? { best: [], failed: [] }
    current.best.push(...item.recoveryEffectiveness.topSuccessfulRecoveryStrategies)
    current.failed.push(...item.recoveryEffectiveness.failedStrategies)
    byTierMap.set(item.autonomyTier, current)
  }

  return {
    byUser: items.map((item) => ({
      userId: item.userId,
      tier: item.autonomyTier,
      bestStrategies: item.recoveryEffectiveness.topSuccessfulRecoveryStrategies,
      failedStrategies: item.recoveryEffectiveness.failedStrategies,
      fatigueRecoveryLeaders: item.recoveryEffectiveness.topSuccessfulRecoveryStrategies,
      trustRecoveryLeaders: item.recoveryEffectiveness.topSuccessfulRecoveryStrategies,
      rollbackPreventionLeaders: item.currentConstraints.rollbackRecommendations,
      pacingStabilizationLeaders: item.recoveryEffectiveness.topSuccessfulRecoveryStrategies,
    })),
    byTier: Array.from(byTierMap.entries()).map(([tier, value]) => ({
      tier,
      bestStrategies: unique(value.best).slice(0, 5),
      failedStrategies: unique(value.failed).slice(0, 5),
    })),
  }
}

export async function buildAutonomyAuditSnapshot(options: {
  limit?: number
  userId?: string | null
  tier?: string | null
} = {}): Promise<AutonomyAuditSnapshot> {
  const limit = Math.max(1, Math.min(100, options.limit ?? 40))
  const requestedUserId = options.userId?.trim() || null
  const requestedTier = options.tier?.trim() || null

  const deploymentSafety = await loadDeploymentSafetyConfig().catch(() => null)
  const invariantEntries = await listInvariantAuditEntries({ limit: 200, userId: requestedUserId }).catch(() => [])
  const shadowEntries = await listShadowModeDecisions(240).catch(() => [])
  const trustRecords = requestedUserId ? [await loadTrustHistoryRecord(requestedUserId)] : await listTrustHistoryRecords(limit)
  const trustRecordMap = new Map(trustRecords.map((record) => [record.userId, record]))
  const profileUsers = requestedUserId ? [await loadAutonomyProfile(requestedUserId)] : await listAutonomyProfiles(limit)

  const userIds = unique([
    ...profileUsers.map((profile) => profile.userId),
    ...trustRecords.map((record) => record.userId),
    ...invariantEntries.map((entry) => entry.userId).filter((value): value is string => Boolean(value)),
    ...shadowEntries.map((entry) => entry.userId),
  ]).slice(0, limit)

  const items: AutonomyAuditItem[] = []

  for (const userId of userIds) {
    const profile = profileUsers.find((item) => item.userId === userId) ?? await loadAutonomyProfile(userId)
    const autonomy = summarizeAutonomyProfile(profile)
    if (requestedTier && autonomy.tier !== requestedTier) {
      continue
    }

    const trustRecord = trustRecordMap.get(userId) ?? await loadTrustHistoryRecord(userId)
    const trustSummary = summarizeTrustHistory(trustRecord)
    const interventionAcceptance = summarizeInterventionAcceptance(trustRecord)
    const continuityRecord = await loadSessionContinuityRecord(userId).catch(() => null)
    const recoveryEffectiveness = summarizeRecoveryEffectiveness({ continuityRecord, trustRecord })
    const continuityConfidence = continuityConfidenceFromRecord(continuityRecord, autonomy)
    const boundary = resolveAdaptivePermissionBoundary({
      profile,
      trustRegime: trustSummary.trustRegime,
      trustMomentum: trustSummary.trustMomentum,
    })

    const rollbackPrediction = predictTrustAwareRollback({
      action: proposedActionForStage(boundary.stage),
      actionStage: boundary.stage,
      trustRegime: trustSummary.trustRegime,
      trustMomentum: trustSummary.trustMomentum,
      driftAlerts: trustSummary.driftAlerts,
      profile,
    })

    const userInvariantEntries = invariantEntries.filter((entry) => entry.userId === userId)
    const recentRollbackAt = [...trustRecord.autonomyAcceptance].reverse().find((entry) => entry.requiredOverride)?.timestamp ?? null
    const invariants = enforceGovernanceInvariants({
      proposedAction: rollbackPrediction.recommendedAction,
      currentAutonomyStage: boundary.stage,
      targetAutonomyStage: boundary.stage,
      inRecoveryMode: trustSummary.trustRegime === "guarded" || continuityConfidence < 0.5,
      inStabilizationMode: continuityConfidence < 0.68,
      trustMomentum: trustSummary.trustMomentum,
      recentRollbackAt,
      cognitiveBudgetRemaining: autonomy.automationComfort,
      suppressCriticalContinuityEvents: false,
    })

    const confidence = scoreAutonomyConfidence({
      decision: invariants.enforcedAction,
      actionStage: boundary.stage,
      rollbackProbability: rollbackPrediction.rollbackProbability,
      trustDisruptionProbability: rollbackPrediction.trustDisruptionProbability,
      interruptionCost: rollbackPrediction.interruptionCost,
      adaptiveComfort: autonomy.automationComfort,
      interventionAcceptanceScore: interventionAcceptance.acceptanceScore,
      recoveryResponsiveness: recoveryEffectiveness.overallResponsiveness,
    })

    const volatility = trustVolatility(trustSummary)
    const instability = autonomyInstability(autonomy, rollbackPrediction)
    const density = interventionDensity(interventionAcceptance)
    const frequency = regulationFrequency(
      userInvariantEntries,
      shadowEntries.filter((entry) => entry.userId === userId),
    )

    const riskForecast = forecastAdaptiveRisk({
      rollbackProbability: rollbackPrediction.rollbackProbability,
      trustDisruptionProbability: rollbackPrediction.trustDisruptionProbability,
      interruptionCost: rollbackPrediction.interruptionCost,
      trustMomentum: trustSummary.trustMomentum,
      trustVolatility: volatility,
      interventionAcceptanceScore: interventionAcceptance.acceptanceScore,
      recoveryResponsiveness: recoveryEffectiveness.overallResponsiveness,
      adaptiveComfort: autonomy.automationComfort,
      pacingTolerance: autonomy.pacingTolerance,
    })

    const deniedActions = unique([
      ...invariants.violations.map((violation) => violation.id),
      ...(confidence.authorityLevel === "assistive" ? [proposedActionForStage(boundary.stage)] : []),
    ])
    const throttledActions = rollbackPrediction.shouldThrottle ? [rollbackPrediction.recommendedAction] : []
    const shadowOnlyDecisions = confidence.authorityLevel === "shadow_only" ? [invariants.enforcedAction] : []
    const rollbackRecommendations = unique([
      rollbackPrediction.recommendedAction,
      ...failedStrategies(recoveryEffectiveness).map((strategy) => `avoid:${strategy}`),
    ]).filter(Boolean)

    items.push({
      userId,
      autonomyTier: autonomy.tier,
      permissionBoundaryStage: boundary.stage,
      trustRegime: trustSummary.trustRegime,
      trustMomentum: trustSummary.trustMomentum,
      continuityConfidence,
      adaptiveComfort: autonomy.automationComfort,
      interventionAcceptanceScore: interventionAcceptance.acceptanceScore,
      currentConstraints: {
        activeThrottles: unique([
          ...(rollbackPrediction.shouldThrottle ? ["rollback_risk"] : []),
          ...(invariants.violations.length > 0 ? ["invariant_enforcement"] : []),
          ...(confidence.authorityLevel === "shadow_only" ? ["shadow_only"] : []),
          ...(deploymentSafety?.operationalMode ? [deploymentSafety.operationalMode] : []),
        ]),
        pacingModifiers: [pacingState(autonomy), continuityConfidence < 0.5 ? "protective" : "adaptive"],
        deniedActions,
        throttledActions,
        shadowOnlyDecisions,
        rollbackRecommendations,
        currentRegulationState: currentRegulationState({
          boundary,
          rollbackPrediction,
          confidence,
          operationalMode: deploymentSafety?.operationalMode ?? "regulated_autonomy",
        }),
      },
      rollbackRisk: rollbackPrediction.rollbackProbability,
      trustDisruptionProbability: rollbackPrediction.trustDisruptionProbability,
      interruptionCost: rollbackPrediction.interruptionCost,
      governanceEnforcement: {
        invariantViolations: invariants.violations,
        deniedActions,
        throttledActions,
        shadowOnlyDecisions,
        rollbackRecommendations,
      },
      recoveryEffectiveness: {
        topSuccessfulRecoveryStrategies: recoveryEffectiveness.fastestRecoveryStrategies,
        failedStrategies: failedStrategies(recoveryEffectiveness),
        recoveryStabilizationLatency: recoveryLatency(continuityRecord),
      },
      behavioralDriftIndicators: {
        trustVolatility: volatility,
        autonomyInstability: instability,
        regulationFrequency: frequency,
        interventionDensity: density,
      },
      autonomyConfidence: confidence,
      adaptiveRiskForecast: riskForecast,
      pacingState: pacingState(autonomy),
      stabilityColor: stabilityColorFromSignals({
        rollbackRisk: rollbackPrediction.rollbackProbability,
        continuityConfidence,
        trustVolatility: volatility,
      }),
      updatedAt: Math.max(autonomy.updatedAt, trustRecord.updatedAt),
    })
  }

  const activeAutonomyTiers = {
    conservative: items.filter((item) => item.autonomyTier === "conservative").length,
    balanced: items.filter((item) => item.autonomyTier === "balanced").length,
    progressive: items.filter((item) => item.autonomyTier === "progressive").length,
    highly_autonomous: items.filter((item) => item.autonomyTier === "highly_autonomous").length,
  }

  const rollbackRiskDistribution = {
    low: items.filter((item) => item.rollbackRisk < 0.35).length,
    medium: items.filter((item) => item.rollbackRisk >= 0.35 && item.rollbackRisk < 0.65).length,
    high: items.filter((item) => item.rollbackRisk >= 0.65).length,
  }

  const decisionReplay = buildDecisionReplay(shadowEntries)
  const invariantTimeline = buildInvariantTimeline(invariantEntries)
  const divergence = buildShadowLiveDivergence(shadowEntries)
  const heatmap = buildGovernanceHeatmap({
    users: items.map((item) => ({
      userId: item.userId,
      interventionDensity: item.behavioralDriftIndicators.interventionDensity,
      trustVolatility: item.behavioralDriftIndicators.trustVolatility,
      rollbackProbability: item.rollbackRisk,
      continuityConfidence: item.continuityConfidence,
      recoveryActivationRate: item.recoveryEffectiveness.topSuccessfulRecoveryStrategies.length > 0 ? 0.6 : 0.2,
      autonomyInstability: item.behavioralDriftIndicators.autonomyInstability,
    })),
    invariantTimeline: invariantEntries,
  })

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      userId: requestedUserId,
      tier: requestedTier,
    },
    globalPosture: {
      operationalMode: deploymentSafety?.operationalMode ?? "regulated_autonomy",
      safeMode: deploymentSafety?.safeMode ?? false,
      forceBalancedMode: deploymentSafety?.forceBalancedMode ?? false,
      quietNotifications: deploymentSafety?.forceQuietNotifications ?? false,
    },
    systemAutonomyHealth: {
      activeAutonomyTiers,
      throttledUsers: items.filter((item) => item.currentConstraints.activeThrottles.length > 0).length,
      rollbackRiskDistribution,
      invariantInterventionRate: items.length > 0 ? invariantEntries.length / items.length : 0,
      recoveryActivationRate: items.length > 0 ? average(items.map((item) => item.recoveryEffectiveness.topSuccessfulRecoveryStrategies.length > 0 ? 1 : 0)) : 0,
      shadowModeDivergence: divergence.divergenceRate,
    },
    userStabilityGrid: items,
    invariantViolationsTimeline: invariantTimeline,
    autonomyDecisionReplay: decisionReplay,
    shadowLiveDivergence: divergence,
    governanceHeatmap: heatmap,
    recoveryIntelligenceEffectiveness: buildRecoveryPanel(items),
    items,
    status: "ok",
  }
}