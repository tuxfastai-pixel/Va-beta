export type CadenceBand = "low" | "moderate" | "high"

export type EquilibriumObservation = {
  timestamp: number
  pressureLevel: number
  fatigueRisk: number
  workspaceDensity: number
  interruptions: number
  recoveryDurationMs: number
  completedActions: number
  abandonedActions: number
}

export type PersonalEquilibriumProfile = {
  preferredCadenceBand: CadenceBand
  preferredActionsPerHour: number
  toleranceThresholds: {
    pressure: number
    fatigue: number
    interruptionsPerHour: number
  }
  recoverySpeed: {
    medianRecoveryMs: number
    confidence: number
  }
  workspaceDensityPreference: number
  interruptionSensitivity: number
  computedAt: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = values.slice().sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)))
  return sorted[index]
}

function cadenceBandFromActions(actionsPerHour: number): CadenceBand {
  if (actionsPerHour >= 9) {
    return "high"
  }
  if (actionsPerHour >= 4.5) {
    return "moderate"
  }
  return "low"
}

export function computePersonalEquilibriumProfile(
  observations: EquilibriumObservation[],
  now = Date.now(),
): PersonalEquilibriumProfile {
  if (observations.length === 0) {
    return {
      preferredCadenceBand: "moderate",
      preferredActionsPerHour: 5,
      toleranceThresholds: {
        pressure: 0.6,
        fatigue: 0.55,
        interruptionsPerHour: 3,
      },
      recoverySpeed: {
        medianRecoveryMs: 2 * 60 * 60 * 1000,
        confidence: 0.2,
      },
      workspaceDensityPreference: 0.55,
      interruptionSensitivity: 0.5,
      computedAt: now,
    }
  }

  const hours = Math.max(
    1 / 60,
    (Math.max(...observations.map((item) => item.timestamp)) -
      Math.min(...observations.map((item) => item.timestamp))) /
      (1000 * 60 * 60),
  )

  const totalCompleted = observations.reduce((sum, item) => sum + item.completedActions, 0)
  const preferredActionsPerHour = totalCompleted / hours

  const pressureSeries = observations.map((item) => clamp01(item.pressureLevel))
  const fatigueSeries = observations.map((item) => clamp01(item.fatigueRisk))
  const interruptionSeries = observations.map((item) => Math.max(0, item.interruptions))
  const densitySeries = observations.map((item) => clamp01(item.workspaceDensity))
  const recoverySeries = observations
    .map((item) => Math.max(0, item.recoveryDurationMs))
    .filter((value) => value > 0)

  const tolerancePressure = clamp01(percentile(pressureSeries, 0.75))
  const toleranceFatigue = clamp01(percentile(fatigueSeries, 0.7))
  const toleranceInterruptions = percentile(interruptionSeries, 0.7)

  const abandonmentPressure = average(
    observations
      .filter((item) => item.abandonedActions > item.completedActions)
      .map((item) => clamp01(item.pressureLevel)),
  )

  const interruptionSensitivity = clamp01(
    0.5 +
      (abandonmentPressure > 0 ? abandonmentPressure - tolerancePressure : 0) +
      (average(interruptionSeries) - toleranceInterruptions) * 0.05,
  )

  return {
    preferredCadenceBand: cadenceBandFromActions(preferredActionsPerHour),
    preferredActionsPerHour,
    toleranceThresholds: {
      pressure: tolerancePressure,
      fatigue: toleranceFatigue,
      interruptionsPerHour: toleranceInterruptions,
    },
    recoverySpeed: {
      medianRecoveryMs: percentile(recoverySeries, 0.5) || 2 * 60 * 60 * 1000,
      confidence: clamp01(Math.min(1, observations.length / 120)),
    },
    workspaceDensityPreference: clamp01(average(densitySeries)),
    interruptionSensitivity,
    computedAt: now,
  }
}

export function mergePersonalEquilibriumProfile(
  previous: PersonalEquilibriumProfile,
  next: PersonalEquilibriumProfile,
  recencyWeight = 0.35,
): PersonalEquilibriumProfile {
  const w = clamp01(recencyWeight)
  const blend = (a: number, b: number) => a * (1 - w) + b * w
  const blendedCadence = blend(previous.preferredActionsPerHour, next.preferredActionsPerHour)

  return {
    preferredCadenceBand: cadenceBandFromActions(blendedCadence),
    preferredActionsPerHour: blendedCadence,
    toleranceThresholds: {
      pressure: blend(previous.toleranceThresholds.pressure, next.toleranceThresholds.pressure),
      fatigue: blend(previous.toleranceThresholds.fatigue, next.toleranceThresholds.fatigue),
      interruptionsPerHour: blend(
        previous.toleranceThresholds.interruptionsPerHour,
        next.toleranceThresholds.interruptionsPerHour,
      ),
    },
    recoverySpeed: {
      medianRecoveryMs: blend(previous.recoverySpeed.medianRecoveryMs, next.recoverySpeed.medianRecoveryMs),
      confidence: clamp01(blend(previous.recoverySpeed.confidence, next.recoverySpeed.confidence)),
    },
    workspaceDensityPreference: clamp01(
      blend(previous.workspaceDensityPreference, next.workspaceDensityPreference),
    ),
    interruptionSensitivity: clamp01(blend(previous.interruptionSensitivity, next.interruptionSensitivity)),
    computedAt: Math.max(previous.computedAt, next.computedAt),
  }
}
