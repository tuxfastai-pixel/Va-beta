function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

export function assessBurnoutRisk(input: {
  workloadIntensity: number
  interruptionRate: number
  recoveryScore: number
  trustStability: number
}) {
  const risk = clamp01(
    input.workloadIntensity * 0.35 +
      input.interruptionRate * 0.3 +
      (1 - input.recoveryScore) * 0.2 +
      (1 - input.trustStability) * 0.15,
  )

  return {
    risk,
    state: risk >= 0.7 ? "high" : risk >= 0.45 ? "watch" : "stable",
    interventions:
      risk >= 0.7
        ? ["Activate quiet mode", "Reduce suggestion volume", "Insert recovery break every 45 minutes"]
        : risk >= 0.45
          ? ["Reduce non-critical notifications", "Add short pacing pauses"]
          : ["Maintain balanced pacing"],
  }
}
