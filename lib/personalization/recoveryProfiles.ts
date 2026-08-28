export type RecoveryObservation = {
  timestamp: number
  fatigueRisk: number
  pressureLevel: number
  recoveryDurationMs: number
  notificationReductionApplied: boolean
  reassuranceApplied: boolean
  simplificationApplied: boolean
  pacingSlowdownApplied: boolean
  stabilized: boolean
}

export type PersonalizedRecoveryProfile = {
  reducedNotificationAffinity: number
  reassuranceAffinity: number
  simplificationAffinity: number
  pacingSlowdownAffinity: number
  expectedRecoveryDurationMs: number
  confidence: number
  learnedAt: number
}

export type RecoveryInterventionPlan = {
  reduceNotifications: boolean
  injectReassurance: boolean
  simplifyStructure: boolean
  slowPacing: boolean
  rationale: string[]
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

function interventionSuccessRate(
  observations: RecoveryObservation[],
  selector: (observation: RecoveryObservation) => boolean,
): number {
  const sample = observations.filter(selector)
  if (sample.length === 0) {
    return 0.5
  }
  return sample.filter((observation) => observation.stabilized).length / sample.length
}

export function learnPersonalizedRecoveryProfile(
  observations: RecoveryObservation[],
  now = Date.now(),
): PersonalizedRecoveryProfile {
  if (observations.length === 0) {
    return {
      reducedNotificationAffinity: 0.6,
      reassuranceAffinity: 0.55,
      simplificationAffinity: 0.6,
      pacingSlowdownAffinity: 0.65,
      expectedRecoveryDurationMs: 2.5 * 60 * 60 * 1000,
      confidence: 0.2,
      learnedAt: now,
    }
  }

  const successfulRecovery = observations.filter((observation) => observation.stabilized)
  const durations = successfulRecovery.map((observation) => Math.max(0, observation.recoveryDurationMs))

  return {
    reducedNotificationAffinity: clamp01(
      interventionSuccessRate(observations, (observation) => observation.notificationReductionApplied),
    ),
    reassuranceAffinity: clamp01(
      interventionSuccessRate(observations, (observation) => observation.reassuranceApplied),
    ),
    simplificationAffinity: clamp01(
      interventionSuccessRate(observations, (observation) => observation.simplificationApplied),
    ),
    pacingSlowdownAffinity: clamp01(
      interventionSuccessRate(observations, (observation) => observation.pacingSlowdownApplied),
    ),
    expectedRecoveryDurationMs: average(durations) || 2.5 * 60 * 60 * 1000,
    confidence: clamp01(Math.min(1, observations.length / 80)),
    learnedAt: now,
  }
}

export function buildRecoveryInterventionPlan(
  profile: PersonalizedRecoveryProfile,
  context: { fatigueRisk: number; pressureLevel: number; interruptionSensitivity: number },
): RecoveryInterventionPlan {
  const fatigue = clamp01(context.fatigueRisk)
  const pressure = clamp01(context.pressureLevel)

  const shouldReduceNotifications =
    fatigue > 0.55 && profile.reducedNotificationAffinity >= 0.5 + context.interruptionSensitivity * 0.2
  const shouldInjectReassurance = fatigue > 0.45 && profile.reassuranceAffinity >= 0.55
  const shouldSimplifyStructure = pressure > 0.55 && profile.simplificationAffinity >= 0.5
  const shouldSlowPacing = (fatigue > 0.5 || pressure > 0.6) && profile.pacingSlowdownAffinity >= 0.55

  const rationale: string[] = []
  if (shouldReduceNotifications) {
    rationale.push("Notification reduction aligns with past stabilization success")
  }
  if (shouldInjectReassurance) {
    rationale.push("Reassurance messaging historically improves recovery")
  }
  if (shouldSimplifyStructure) {
    rationale.push("Structure simplification matches user recovery preference")
  }
  if (shouldSlowPacing) {
    rationale.push("Pacing slowdown is recommended during current fatigue/pressure")
  }

  return {
    reduceNotifications: shouldReduceNotifications,
    injectReassurance: shouldInjectReassurance,
    simplifyStructure: shouldSimplifyStructure,
    slowPacing: shouldSlowPacing,
    rationale,
  }
}
