import { buildTrustRegulationPlan } from "./trustRegulationEngine.ts"
import { computeTrustMetrics, type TrustMetricSignals } from "./trustMetrics.ts"
import type { TrustDriftAlert, TrustHistoryRecord } from "./trustHistoryStore.ts"

export type TrustGateDecision = {
  canUserComfortablyAbsorbThis: boolean
  recommendedAction: string
  reasoning: string[]
  trustRegime: "guarded" | "balanced" | "progressive"
  automationThrottle: number
  metrics: ReturnType<typeof computeTrustMetrics>
  signals: TrustMetricSignals
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0.5
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function deriveSignals(record: TrustHistoryRecord): TrustMetricSignals {
  const windows = record.trustWindows.slice(-18)
  if (windows.length > 0) {
    const values = windows.map((window) => window.signals)
    return {
      recoveryAcceptanceRate: average(values.map((item) => item.recoveryAcceptanceRate)),
      resumeAbandonmentRate: average(values.map((item) => item.resumeAbandonmentRate)),
      repeatedRestartRate: average(values.map((item) => item.repeatedRestartRate)),
      sessionHesitationRate: average(values.map((item) => item.sessionHesitationRate)),
      notificationDismissalRate: average(values.map((item) => item.notificationDismissalRate)),
      modeOverrideRate: average(values.map((item) => item.modeOverrideRate)),
      rapidUiExitRate: average(values.map((item) => item.rapidUiExitRate)),
      reductionRequestRate: average(values.map((item) => item.reductionRequestRate)),
      rollbackFrequencyRate: average(values.map((item) => item.rollbackFrequencyRate)),
      trustDecayRate: average(values.map((item) => item.trustDecayRate)),
      oscillationExposureRate: average(values.map((item) => item.oscillationExposureRate)),
      recoverySuccessRate: average(values.map((item) => item.recoverySuccessRate)),
      interventionHelpfulRate: average(values.map((item) => item.interventionHelpfulRate)),
      interventionControllingRate: average(values.map((item) => item.interventionControllingRate)),
      interventionProtectiveRate: average(values.map((item) => item.interventionProtectiveRate)),
      interventionFrustratingRate: average(values.map((item) => item.interventionFrustratingRate)),
      automationComfortRate: average(values.map((item) => item.automationComfortRate)),
      adaptationComfortRate: average(values.map((item) => item.adaptationComfortRate)),
      orchestrationComfortRate: average(values.map((item) => item.orchestrationComfortRate)),
      autonomousPacingComfortRate: average(values.map((item) => item.autonomousPacingComfortRate)),
    }
  }

  const interventions = record.interventionEffects.slice(-12)
  const reactions = record.pacingReactions.slice(-12)
  const recovery = record.recoveryOutcomes.slice(-12)
  const autonomy = record.autonomyAcceptance.slice(-12)

  return {
    recoveryAcceptanceRate:
      recovery.length > 0
        ? average(recovery.map((item) => (item.successful ? item.userConfidence : item.userConfidence * 0.5)))
        : 0.6,
    resumeAbandonmentRate: reactions.length > 0 ? average(reactions.map((item) => item.overwhelmSignal)) : 0.2,
    repeatedRestartRate: reactions.length > 0 ? average(reactions.map((item) => (item.reductionRequested ? 0.8 : 0.2))) : 0.18,
    sessionHesitationRate: reactions.length > 0 ? average(reactions.map((item) => item.overwhelmSignal * 0.8)) : 0.2,
    notificationDismissalRate: reactions.length > 0 ? average(reactions.map((item) => item.overwhelmSignal)) : 0.25,
    modeOverrideRate: autonomy.length > 0 ? average(autonomy.map((item) => (item.requiredOverride ? 1 : 0))) : 0.2,
    rapidUiExitRate: reactions.length > 0 ? average(reactions.map((item) => item.overwhelmSignal * 0.7)) : 0.2,
    reductionRequestRate: reactions.length > 0 ? average(reactions.map((item) => (item.reductionRequested ? 1 : 0))) : 0.2,
    rollbackFrequencyRate: interventions.length > 0 ? average(interventions.map((item) => (item.accepted ? 0.15 : 0.55))) : 0.25,
    trustDecayRate: autonomy.length > 0 ? average(autonomy.map((item) => 1 - item.comfort)) : 0.25,
    oscillationExposureRate: reactions.length > 0 ? average(reactions.map((item) => Math.abs(item.supportiveSignal - item.overwhelmSignal))) : 0.2,
    recoverySuccessRate: recovery.length > 0 ? average(recovery.map((item) => (item.successful ? 1 : 0))) : 0.65,
    interventionHelpfulRate:
      interventions.length > 0 ? average(interventions.map((item) => (item.accepted ? item.perceivedSupport : item.perceivedSupport * 0.6))) : 0.68,
    interventionControllingRate: interventions.length > 0 ? average(interventions.map((item) => (item.accepted ? 0.25 : 0.75))) : 0.28,
    interventionProtectiveRate: interventions.length > 0 ? average(interventions.map((item) => item.perceivedSupport)) : 0.7,
    interventionFrustratingRate: interventions.length > 0 ? average(interventions.map((item) => (item.accepted ? 0.2 : 0.8))) : 0.25,
    automationComfortRate: autonomy.length > 0 ? average(autonomy.map((item) => item.comfort)) : 0.65,
    adaptationComfortRate: autonomy.length > 0 ? average(autonomy.map((item) => (item.accepted ? item.comfort : item.comfort * 0.6))) : 0.64,
    orchestrationComfortRate: autonomy.length > 0 ? average(autonomy.map((item) => item.comfort * (item.requiredOverride ? 0.7 : 1))) : 0.62,
    autonomousPacingComfortRate: reactions.length > 0 ? average(reactions.map((item) => item.supportiveSignal)) : 0.66,
  }
}

function highSeverityDriftCount(alerts: TrustDriftAlert[]): number {
  return alerts.filter((alert) => alert.severity === "high").length
}

export function evaluateOrchestrationTrustGate(input: {
  action: string
  record: TrustHistoryRecord
  driftAlerts: TrustDriftAlert[]
}): TrustGateDecision {
  const signals = deriveSignals(input.record)
  const metrics = computeTrustMetrics(signals)
  const plan = buildTrustRegulationPlan(metrics)

  const highSeverityCount = highSeverityDriftCount(input.driftAlerts)
  const reasons = [...plan.reasons]
  if (highSeverityCount > 0) {
    reasons.push(`High-severity trust drift alerts: ${highSeverityCount}`)
  }

  let recommendedAction = input.action
  if (plan.autonomyLevel === "guarded") {
    if (input.action === "send_proposals") {
      recommendedAction = "manual_review_required"
    } else if (input.action === "execute_tasks") {
      recommendedAction = "awaiting_user_action"
    }
  }

  if (plan.autonomyLevel === "balanced" && input.action === "send_proposals") {
    recommendedAction = "manual_review_required"
  }

  const canUserComfortablyAbsorbThis =
    plan.autonomyLevel !== "guarded" && highSeverityCount === 0 && metrics.adaptiveComfortIndex >= 0.45

  return {
    canUserComfortablyAbsorbThis,
    recommendedAction,
    reasoning: reasons,
    trustRegime: plan.autonomyLevel,
    automationThrottle: plan.automationThrottle,
    metrics,
    signals,
  }
}
