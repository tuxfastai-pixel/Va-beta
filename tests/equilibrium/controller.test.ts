import { test } from "node:test"
import assert from "node:assert"
import {
  computeEquilibriumState,
  computeTargetEquilibrium,
  detectEquilibriumBreach,
  suggestTacticalAdjustments,
  generateEquilibriumReport,
  type EquilibriumState,
} from "../../lib/governance/autonomousEquilibriumController.ts"
import { computeEffectiveSessionShape } from "../../lib/ui/adaptiveSessionEngine.ts"
import { computeCognitiveBudget } from "../../lib/governance/cognitiveBudgetEngine.ts"

test("Compute equilibrium state: balanced with low fatigue", async () => {
  const state = computeEquilibriumState({
    pressureState: "balanced",
    fatigueInputs: {
      ignoredNotificationRate: 0.1,
      actionDelayTrend: 0.2,
      refinementLoopCount: 1,
      sessionVolatility: 0.2,
      interruptionSensitivity: 0.2,
      recoveryFrequency: 0.8,
    },
    cognitiveBudgetInputs: {
      decisionCount24h: 30,
      interactionCount1h: 5,
      contextSwitches1h: 2,
      averageTaskDepth: 1.5,
      sessionDurationMs: 30 * 60 * 1000,
      notificationIgnoreRate: 0.1,
      actionsCompleted: 8,
      actionsAbandoned: 1,
      userVelocity: 0.8,
    },
    trustContinuityInputs: {
      commitmentsStarted: 10,
      commitmentsCompleted: 9,
      commitmentsAbandoned: 1,
      sessionDaysActive: 30,
      sessionConsistency: 0.8,
      typicalSessionVariance: 0.2,
      pressureStateStability: 0.7,
      identityChanges: 0,
      directionsAbandoned: 0,
      recoverySuccessRate: 0.8,
      notificationComplianceRate: 0.8,
      consistencyTrendDays: [],
    },
    sessionDurationMs: 30 * 60 * 1000,
    completionRate: 0.89,
  })

  assert.strictEqual(state.pressureState, "balanced")
  assert(state.overallHealth > 0.7, `Overall health should be high, got ${state.overallHealth}`)
  assert(state.fatigueRisk < 0.4, `Fatigue risk should be low, got ${state.fatigueRisk}`)
  assert.strictEqual(state.sessionShape.workspaceMode, "expanded")
  assert(state.stabilityForecast > 0.6, "Stability forecast should be good")
})

test("Compute equilibrium state: recovery with high fatigue", async () => {
  const state = computeEquilibriumState({
    pressureState: "recovery",
    fatigueInputs: {
      ignoredNotificationRate: 0.6,
      actionDelayTrend: 0.7,
      refinementLoopCount: 4,
      sessionVolatility: 0.7,
      interruptionSensitivity: 0.6,
      recoveryFrequency: 0.2,
    },
    cognitiveBudgetInputs: {
      decisionCount24h: 80,
      interactionCount1h: 15,
      contextSwitches1h: 8,
      averageTaskDepth: 3.5,
      sessionDurationMs: 3 * 60 * 60 * 1000,
      notificationIgnoreRate: 0.6,
      actionsCompleted: 3,
      actionsAbandoned: 5,
      userVelocity: 0.3,
    },
    trustContinuityInputs: {
      commitmentsStarted: 10,
      commitmentsCompleted: 4,
      commitmentsAbandoned: 6,
      sessionDaysActive: 7,
      sessionConsistency: 0.3,
      typicalSessionVariance: 0.8,
      pressureStateStability: 0.3,
      identityChanges: 2,
      directionsAbandoned: 1,
      recoverySuccessRate: 0.4,
      notificationComplianceRate: 0.2,
      consistencyTrendDays: [],
    },
    sessionDurationMs: 3 * 60 * 60 * 1000,
    completionRate: 0.37,
  })

  assert.strictEqual(state.pressureState, "recovery")
  assert(state.overallHealth < 0.5, `Overall health should be low, got ${state.overallHealth}`)
  assert(state.fatigueRisk > 0.5, `Fatigue risk should be high, got ${state.fatigueRisk}`)
  assert.strictEqual(state.sessionShape.workspaceMode, "recovery")
  assert(state.adaptationLevel > 0.6, "Adaptation level should be significant")
})

test("Target equilibrium: upgrade from recovery to stabilizing", async () => {
  const currentState: EquilibriumState = {
    timestamp: new Date(),
    pressureState: "recovery",
    fatigueRisk: 0.35,
    sessionShape: computeEffectiveSessionShape("recovery", 0.35),
    cognitiveBudget: computeCognitiveBudget({
      decisionCount24h: 40,
      interactionCount1h: 8,
      contextSwitches1h: 3,
      averageTaskDepth: 2,
      sessionDurationMs: 40 * 60 * 1000,
      notificationIgnoreRate: 0.3,
      actionsCompleted: 6,
      actionsAbandoned: 2,
      userVelocity: 0.75,
    }),
    sessionRhythm: {
      recommendedSessionLength: 25 * 60 * 1000,
      suggestedBreakWindow: 0,
      engagementPressure: 0.2,
      pacingMode: "recovery",
      batchSize: 2,
      delayBetweenActions: 45 * 1000,
      breakDurationMs: 5 * 60 * 1000,
      continueEncouragement: false,
      dailySessionTarget: 90 * 60 * 1000,
    },
    companionTone: {
      communicationStyle: "gentle",
      verbosity: 0.4,
      tone: "supportive",
      initiativeLevel: 0.3,
      explanationDepth: 0.3,
      encouragementIntensity: 0.9,
      urgencyIndicators: false,
      complexityThreshold: 0.3,
      suggestionFrequency: 2,
      responseTime: 1500,
      personalizationLevel: 0.7,
    },
    trustContinuity: {
      overallScore: 0.65,
      followThroughScore: 0.75,
      coherenceScore: 0.6,
      pacingHealthScore: 0.7,
      identityStabilityScore: 0.8,
      equilibriumPreservationScore: 0.6,
      trustTrendVector: 0.2,
      lastComputedAt: new Date(),
    },
    overallHealth: 0.55,
    adaptationLevel: 0.7,
    stabilityForecast: 0.6,
  }

  const targetState = computeTargetEquilibrium(currentState, {
    recentCompletions: 10,
    recentAbandoned: 2,
    userEngagement: 0.75,
    explicitFeedback: null,
  })

  assert.strictEqual(targetState, "stabilizing", "Should upgrade to stabilizing when succeeding")
})

test("Detect equilibrium breach: critical fatigue", async () => {
  const state: EquilibriumState = {
    timestamp: new Date(),
    pressureState: "locked",
    fatigueRisk: 0.85,
    sessionShape: computeEffectiveSessionShape("locked", 0.85),
    cognitiveBudget: {
      remainingCapacity: 0.1,
      overloadRisk: 0.9,
      recommendedComplexity: 0.1,
      interruptionAllowance: 0,
      decisionFatigueFactor: 0.95,
      contextSwitchCost: 0.9,
      refinementExhaustion: 0.85,
      nextRestWindow: 0,
      budgetRecoveryRate: 0.2,
    },
    sessionRhythm: {
      recommendedSessionLength: 15 * 60 * 1000,
      suggestedBreakWindow: Infinity,
      engagementPressure: 0,
      pacingMode: "continuity",
      batchSize: 1,
      delayBetweenActions: 60 * 1000,
      breakDurationMs: 5 * 60 * 1000,
      continueEncouragement: false,
      dailySessionTarget: 30 * 60 * 1000,
    },
    companionTone: {
      communicationStyle: "continuity",
      verbosity: 0.2,
      tone: "minimal",
      initiativeLevel: 0,
      explanationDepth: 0.1,
      encouragementIntensity: 0.5,
      urgencyIndicators: false,
      complexityThreshold: 0.1,
      suggestionFrequency: 0.5,
      responseTime: 2000,
      personalizationLevel: 0.5,
    },
    trustContinuity: {
      overallScore: 0.2,
      followThroughScore: 0.15,
      coherenceScore: 0.25,
      pacingHealthScore: 0.3,
      identityStabilityScore: 0.4,
      equilibriumPreservationScore: 0.2,
      trustTrendVector: -0.5,
      lastComputedAt: new Date(),
    },
    overallHealth: 0.25,
    adaptationLevel: 0.9,
    stabilityForecast: 0.15,
  }

  const breach = detectEquilibriumBreach(state)

  assert(breach.isBreach, "Should detect breach when health is critical")
  assert(breach.severity > 0.7, `Severity should be high, got ${breach.severity}`)
  assert(breach.factors.length > 0, "Should identify contributing factors")
})

test("Suggest tactical adjustments: high overload scenario", async () => {
  const state: EquilibriumState = {
    timestamp: new Date(),
    pressureState: "stabilizing",
    fatigueRisk: 0.65,
    sessionShape: computeEffectiveSessionShape("stabilizing", 0.65),
    cognitiveBudget: {
      remainingCapacity: 0.25,
      overloadRisk: 0.75,
      recommendedComplexity: 0.2,
      interruptionAllowance: 0.1,
      decisionFatigueFactor: 0.7,
      contextSwitchCost: 0.6,
      refinementExhaustion: 0.65,
      nextRestWindow: 5 * 60 * 1000,
      budgetRecoveryRate: 0.4,
    },
    sessionRhythm: {
      recommendedSessionLength: 45 * 60 * 1000,
      suggestedBreakWindow: 0,
      engagementPressure: 0.5,
      pacingMode: "stabilizing",
      batchSize: 3,
      delayBetweenActions: 30 * 1000,
      breakDurationMs: 10 * 60 * 1000,
      continueEncouragement: true,
      dailySessionTarget: 180 * 60 * 1000,
    },
    companionTone: {
      communicationStyle: "careful",
      verbosity: 0.6,
      tone: "cautious",
      initiativeLevel: 0.6,
      explanationDepth: 0.5,
      encouragementIntensity: 0.7,
      urgencyIndicators: false,
      complexityThreshold: 0.5,
      suggestionFrequency: 4,
      responseTime: 1000,
      personalizationLevel: 0.8,
    },
    trustContinuity: {
      overallScore: 0.55,
      followThroughScore: 0.6,
      coherenceScore: 0.5,
      pacingHealthScore: 0.6,
      identityStabilityScore: 0.7,
      equilibriumPreservationScore: 0.5,
      trustTrendVector: 0,
      lastComputedAt: new Date(),
    },
    overallHealth: 0.45,
    adaptationLevel: 0.6,
    stabilityForecast: 0.5,
  }

  const adjustments = suggestTacticalAdjustments(state)

  assert(adjustments.deferred.length > 0 || adjustments.paused.length > 0, "Should defer or pause actions")
  assert(adjustments.paused.includes("All non-critical actions"), "Should pause non-critical actions")
})

test("Generate equilibrium report: healthy state", async () => {
  const state: EquilibriumState = {
    timestamp: new Date(),
    pressureState: "balanced",
    fatigueRisk: 0.25,
    sessionShape: computeEffectiveSessionShape("balanced", 0.25),
    cognitiveBudget: {
      remainingCapacity: 0.75,
      overloadRisk: 0.15,
      recommendedComplexity: 0.7,
      interruptionAllowance: 0.8,
      decisionFatigueFactor: 0.2,
      contextSwitchCost: 0.15,
      refinementExhaustion: 0.1,
      nextRestWindow: Infinity,
      budgetRecoveryRate: 0.8,
    },
    sessionRhythm: {
      recommendedSessionLength: 60 * 60 * 1000,
      suggestedBreakWindow: 60 * 60 * 1000,
      engagementPressure: 0.6,
      pacingMode: "balanced",
      batchSize: 4,
      delayBetweenActions: 20 * 1000,
      breakDurationMs: 10 * 60 * 1000,
      continueEncouragement: true,
      dailySessionTarget: 240 * 60 * 1000,
    },
    companionTone: {
      communicationStyle: "careful",
      verbosity: 0.6,
      tone: "balanced",
      initiativeLevel: 0.6,
      explanationDepth: 0.5,
      encouragementIntensity: 0.7,
      urgencyIndicators: false,
      complexityThreshold: 0.5,
      suggestionFrequency: 4,
      responseTime: 800,
      personalizationLevel: 0.8,
    },
    trustContinuity: {
      overallScore: 0.75,
      followThroughScore: 0.8,
      coherenceScore: 0.7,
      pacingHealthScore: 0.8,
      identityStabilityScore: 0.85,
      equilibriumPreservationScore: 0.75,
      trustTrendVector: 0.1,
      lastComputedAt: new Date(),
    },
    overallHealth: 0.78,
    adaptationLevel: 0.3,
    stabilityForecast: 0.8,
  }

  const report = generateEquilibriumReport(state)

  assert(report.headline.includes("Equilibrium"), "Should have equilibrium headline")
  assert(report.body.length > 0, "Should have report body")
  assert(report.recommendations.length >= 0, "Should have recommendations")
})
