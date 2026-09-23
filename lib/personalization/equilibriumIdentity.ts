import type { PersonalEquilibriumProfile } from "./equilibriumProfile.ts"
import type { BehavioralRhythmLearning } from "./rhythmLearning.ts"
import type { PersonalizedRecoveryProfile } from "./recoveryProfiles.ts"
import type { AdaptiveTrustModel } from "./trustContinuity.ts"

export type EquilibriumIdentity = {
  fingerprint: string
  pacingStyle: "deliberate" | "adaptive" | "fast-cycle"
  continuityStyle: "anchor-driven" | "exploratory" | "mixed"
  recoveryStyle: "quiet-recovery" | "reassurance-led" | "structured-reset" | "paced-reset"
  communicationRhythm: "light" | "moderate" | "dense"
  workspaceTolerance: "compact" | "balanced" | "expanded"
  adaptationConfidence: number
  createdAt: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function hashText(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function computeRecoveryStyle(profile: PersonalizedRecoveryProfile): EquilibriumIdentity["recoveryStyle"] {
  const ranked = [
    ["quiet-recovery", profile.reducedNotificationAffinity],
    ["reassurance-led", profile.reassuranceAffinity],
    ["structured-reset", profile.simplificationAffinity],
    ["paced-reset", profile.pacingSlowdownAffinity],
  ] as const

  return ranked.slice().sort((a, b) => b[1] - a[1])[0]?.[0] ?? "paced-reset"
}

export function buildEquilibriumIdentity(input: {
  profile: PersonalEquilibriumProfile
  rhythm: BehavioralRhythmLearning
  recovery: PersonalizedRecoveryProfile
  trust: AdaptiveTrustModel
  now?: number
}): EquilibriumIdentity {
  const now = input.now ?? Date.now()

  const pacingStyle: EquilibriumIdentity["pacingStyle"] =
    input.profile.preferredActionsPerHour >= 9
      ? "fast-cycle"
      : input.profile.preferredActionsPerHour <= 4
        ? "deliberate"
        : "adaptive"

  const continuityStyle: EquilibriumIdentity["continuityStyle"] =
    input.trust.continuityConfidence >= 0.7
      ? "anchor-driven"
      : input.trust.continuityConfidence <= 0.42
        ? "exploratory"
        : "mixed"

  const communicationRhythm: EquilibriumIdentity["communicationRhythm"] =
    input.profile.interruptionSensitivity > 0.7
      ? "light"
      : input.profile.interruptionSensitivity < 0.4
        ? "dense"
        : "moderate"

  const workspaceTolerance: EquilibriumIdentity["workspaceTolerance"] =
    input.profile.workspaceDensityPreference >= 0.7
      ? "expanded"
      : input.profile.workspaceDensityPreference <= 0.42
        ? "compact"
        : "balanced"

  const adaptationConfidence = clamp01(
    input.profile.recoverySpeed.confidence * 0.25 +
      input.recovery.confidence * 0.25 +
      input.trust.trustStability * 0.25 +
      Math.min(1, input.rhythm.hourlyProfile.filter((item) => item.accelerationScore > 0.5).length / 8) * 0.25,
  )

  const fingerprint = hashText(
    [
      pacingStyle,
      continuityStyle,
      computeRecoveryStyle(input.recovery),
      communicationRhythm,
      workspaceTolerance,
      input.profile.preferredCadenceBand,
      input.rhythm.accelerationWindows.join("-"),
      input.rhythm.bestRecoveryWindows.join("-"),
      adaptationConfidence.toFixed(3),
    ].join("|"),
  )

  return {
    fingerprint,
    pacingStyle,
    continuityStyle,
    recoveryStyle: computeRecoveryStyle(input.recovery),
    communicationRhythm,
    workspaceTolerance,
    adaptationConfidence,
    createdAt: now,
  }
}

export function identityChanged(
  previous: EquilibriumIdentity,
  next: EquilibriumIdentity,
): { changed: boolean; delta: number } {
  if (previous.fingerprint === next.fingerprint) {
    return { changed: false, delta: 0 }
  }

  const styleDiff = [
    previous.pacingStyle !== next.pacingStyle,
    previous.continuityStyle !== next.continuityStyle,
    previous.recoveryStyle !== next.recoveryStyle,
    previous.communicationRhythm !== next.communicationRhythm,
    previous.workspaceTolerance !== next.workspaceTolerance,
  ].filter(Boolean).length

  return {
    changed: true,
    delta: Math.min(1, styleDiff / 5 + Math.abs(previous.adaptationConfidence - next.adaptationConfidence) * 0.5),
  }
}
