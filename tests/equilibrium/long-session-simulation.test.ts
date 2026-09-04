import { test } from "node:test"
import assert from "node:assert"
import { computeEquilibriumState, computeTargetEquilibrium } from "../../lib/governance/autonomousEquilibriumController.ts"

type ScenarioInputs = {
  ignoredNotificationRate: number
  actionDelayTrend: number
  refinementLoopCount: number
  sessionVolatility: number
  interruptionSensitivity: number
  recoveryFrequency: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function runSimulation(hours: number, profile: "heavy" | "fatigue" | "oscillation" | "saturation") {
  const stepMinutes = 10
  const steps = Math.floor((hours * 60) / stepMinutes)
  const healthSeries: number[] = []
  const fatigueSeries: number[] = []
  const pressureSeries: string[] = []
  const workspaceModes: string[] = []

  let pressureState: "accelerated" | "balanced" | "stabilizing" | "recovery" | "locked" = "balanced"

  for (let i = 0; i < steps; i++) {
    const t = i / Math.max(1, steps - 1)
    const oscillationWave = Math.sin(i / 4)

    const scenario: ScenarioInputs = {
      ignoredNotificationRate:
        profile === "saturation"
          ? clamp01(0.35 + t * 0.45)
          : profile === "fatigue"
            ? clamp01(0.25 + t * 0.4)
            : clamp01(0.18 + Math.max(0, oscillationWave) * 0.18),
      actionDelayTrend: profile === "fatigue" ? clamp01(0.3 + t * 0.5) : clamp01(0.25 + Math.abs(oscillationWave) * 0.25),
      refinementLoopCount: profile === "heavy" ? 3 + (i % 4) : 2 + (i % 3),
      sessionVolatility:
        profile === "oscillation"
          ? clamp01(0.35 + Math.abs(oscillationWave) * 0.55)
          : clamp01(0.18 + t * 0.25),
      interruptionSensitivity:
        profile === "saturation" ? clamp01(0.45 + t * 0.45) : clamp01(0.25 + Math.abs(oscillationWave) * 0.3),
      recoveryFrequency:
        profile === "fatigue" ? clamp01(0.75 - t * 0.5) : profile === "oscillation" ? clamp01(0.55 - Math.abs(oscillationWave) * 0.25) : 0.65,
    }

    const completionRate = profile === "heavy" ? 0.72 : profile === "fatigue" ? clamp01(0.68 - t * 0.38) : 0.58

    const state = computeEquilibriumState({
      pressureState,
      fatigueInputs: scenario,
      cognitiveBudgetInputs: {
        decisionCount24h: profile === "heavy" ? 85 : 65,
        interactionCount1h: profile === "saturation" ? 17 : 12,
        contextSwitches1h: profile === "oscillation" ? 8 : 5,
        averageTaskDepth: profile === "fatigue" ? 3.8 : 2.6,
        sessionDurationMs: (i + 1) * stepMinutes * 60 * 1000,
        notificationIgnoreRate: scenario.ignoredNotificationRate,
        actionsCompleted: Math.max(1, Math.round((i + 1) * completionRate * 0.7)),
        actionsAbandoned: Math.max(0, Math.round((i + 1) * (1 - completionRate) * 0.4)),
        userVelocity: clamp01(0.75 - scenario.actionDelayTrend * 0.5),
      },
      trustContinuityInputs: {
        commitmentsStarted: i + 5,
        commitmentsCompleted: Math.round((i + 5) * completionRate),
        commitmentsAbandoned: Math.round((i + 5) * (1 - completionRate)),
        sessionDaysActive: Math.max(7, Math.floor(i / 6) + 7),
        sessionConsistency: clamp01(0.82 - scenario.sessionVolatility * 0.35),
        typicalSessionVariance: clamp01(0.22 + scenario.sessionVolatility * 0.5),
        pressureStateStability: clamp01(0.6 - Math.abs(oscillationWave) * 0.35),
        identityChanges: Math.round(Math.abs(oscillationWave) * 2),
        directionsAbandoned: Math.round((1 - completionRate) * 2),
        recoverySuccessRate: clamp01(scenario.recoveryFrequency),
        notificationComplianceRate: clamp01(1 - scenario.ignoredNotificationRate * 0.9),
        consistencyTrendDays: [],
      },
      sessionDurationMs: (i + 1) * stepMinutes * 60 * 1000,
      completionRate,
    })

    healthSeries.push(state.overallHealth)
    fatigueSeries.push(state.fatigueRisk)
    pressureSeries.push(state.pressureState)
    workspaceModes.push(state.sessionShape.workspaceMode)

    pressureState = computeTargetEquilibrium(state, {
      recentCompletions: Math.max(0, Math.round(completionRate * 12)),
      recentAbandoned: Math.max(0, Math.round((1 - completionRate) * 8)),
      userEngagement: clamp01(completionRate + 0.1),
      explicitFeedback: null,
    })
  }

  return { healthSeries, fatigueSeries, pressureSeries, workspaceModes }
}

test("Heavy user 8h: no equilibrium drift collapse", () => {
  const result = runSimulation(8, "heavy")
  const avgHealth = result.healthSeries.reduce((sum, value) => sum + value, 0) / result.healthSeries.length
  const maxFatigue = Math.max(...result.fatigueSeries)

  assert(avgHealth > 0.35, `Average health should remain above drift threshold, got ${avgHealth}`)
  assert(maxFatigue < 0.9, `Fatigue should not explode to extreme saturation, got ${maxFatigue}`)
})

test("Fatigue accumulation multi-session: pacing remains adaptive", () => {
  const result = runSimulation(16, "fatigue")
  const enteredProtectivePressureState =
    result.pressureSeries.includes("stabilizing") ||
    result.pressureSeries.includes("recovery") ||
    result.pressureSeries.includes("locked")
  const contractedWorkspace =
    result.workspaceModes.includes("focused") ||
    result.workspaceModes.includes("recovery") ||
    result.workspaceModes.includes("continuity")

  assert(enteredProtectivePressureState, "System should downshift under sustained fatigue accumulation")
  assert(contractedWorkspace, "Workspace should contract in prolonged fatigue conditions")
})

test("Oscillation recovery 24h: avoids runaway oscillation loops", () => {
  const result = runSimulation(24, "oscillation")

  let transitions = 0
  for (let i = 1; i < result.pressureSeries.length; i++) {
    if (result.pressureSeries[i] !== result.pressureSeries[i - 1]) {
      transitions += 1
    }
  }

  const transitionRate = transitions / Math.max(1, result.pressureSeries.length)
  assert(transitionRate < 0.7, `Transition rate should not indicate runaway oscillation, got ${transitionRate}`)
})

test("Notification saturation sustained: overload prevention engages", () => {
  const result = runSimulation(10, "saturation")
  const highFatigueCount = result.fatigueSeries.filter((value) => value > 0.6).length
  const protectiveStates = result.pressureSeries.filter(
    (state) => state === "stabilizing" || state === "recovery" || state === "locked",
  ).length
  const contractedModes = result.workspaceModes.filter(
    (mode) => mode === "focused" || mode === "recovery" || mode === "continuity",
  ).length

  assert(highFatigueCount > 0, "Saturation scenario should produce high fatigue windows")
  assert(protectiveStates > 0 || contractedModes > 0, "System should engage protective adaptation during saturation windows")
})
