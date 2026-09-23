export type RhythmSignal = {
  timestamp: number
  actionsCompleted: number
  actionsAbandoned: number
  fatigueRisk: number
  pressureLevel: number
  recovered: boolean
}

export type HourlyRhythmProfile = {
  hour: number
  accelerationScore: number
  fatigueScore: number
  disengagementScore: number
  recoveryScore: number
}

export type BehavioralRhythmLearning = {
  hourlyProfile: HourlyRhythmProfile[]
  accelerationWindows: number[]
  fatigueWindows: number[]
  disengagementWindows: number[]
  bestRecoveryWindows: number[]
  learnedAt: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function toHour(timestamp: number): number {
  return new Date(timestamp).getHours()
}

export function learnBehavioralRhythm(
  signals: RhythmSignal[],
  now = Date.now(),
): BehavioralRhythmLearning {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    signals: [] as RhythmSignal[],
  }))

  for (const signal of signals) {
    buckets[toHour(signal.timestamp)]?.signals.push(signal)
  }

  const hourlyProfile: HourlyRhythmProfile[] = buckets.map((bucket) => {
    const count = Math.max(1, bucket.signals.length)
    const completed = bucket.signals.reduce((sum, signal) => sum + signal.actionsCompleted, 0)
    const abandoned = bucket.signals.reduce((sum, signal) => sum + signal.actionsAbandoned, 0)
    const fatigueAvg =
      bucket.signals.reduce((sum, signal) => sum + clamp01(signal.fatigueRisk), 0) / count
    const pressureAvg =
      bucket.signals.reduce((sum, signal) => sum + clamp01(signal.pressureLevel), 0) / count
    const recoveredRate =
      bucket.signals.filter((signal) => signal.recovered).length / count

    const accelerationScore = clamp01((completed / Math.max(1, completed + abandoned)) * (1 - fatigueAvg * 0.55))
    const disengagementScore = clamp01(abandoned / Math.max(1, completed + abandoned))
    const fatigueScore = clamp01(fatigueAvg * 0.7 + pressureAvg * 0.3)
    const recoveryScore = clamp01(recoveredRate * 0.7 + (1 - fatigueAvg) * 0.3)

    return {
      hour: bucket.hour,
      accelerationScore,
      fatigueScore,
      disengagementScore,
      recoveryScore,
    }
  })

  const pickTop = (selector: (item: HourlyRhythmProfile) => number, invert = false): number[] => {
    const sorted = hourlyProfile
      .slice()
      .sort((a, b) => (invert ? selector(a) - selector(b) : selector(b) - selector(a)))
    return sorted.slice(0, 4).map((item) => item.hour)
  }

  return {
    hourlyProfile,
    accelerationWindows: pickTop((item) => item.accelerationScore),
    fatigueWindows: pickTop((item) => item.fatigueScore),
    disengagementWindows: pickTop((item) => item.disengagementScore),
    bestRecoveryWindows: pickTop((item) => item.recoveryScore),
    learnedAt: now,
  }
}

export function recommendRhythmWindow(
  learning: BehavioralRhythmLearning,
  goal: "deep_work" | "low_pressure" | "recovery",
): number[] {
  if (goal === "deep_work") {
    return learning.accelerationWindows
  }
  if (goal === "recovery") {
    return learning.bestRecoveryWindows
  }

  const lowPressure = learning.hourlyProfile
    .slice()
    .sort((a, b) => a.fatigueScore + a.disengagementScore - (b.fatigueScore + b.disengagementScore))
    .slice(0, 4)
    .map((item) => item.hour)
  return lowPressure
}
