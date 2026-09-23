export type TempoInputs = {
  governanceHealth: number;
  realismScore: number;
  stabilityEfficiencyRatio: number;
  recruiterSuspicionRisk: number;
  warningDensity: number;
  trustConsistency: number;
};

export type TempoOutput = {
  adaptationVelocity: number;
  mutationCooldownMs: number;
  explorationBreadth: number;
  stabilizationBias: number;
  mode: "accelerated" | "balanced" | "stabilizing" | "recovery";
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function computeAdaptiveTempo(input: TempoInputs): TempoOutput {
  const adaptationVelocity = Math.max(
    0.1,
    Math.min(
      1,
      input.governanceHealth *
        input.realismScore *
        input.stabilityEfficiencyRatio *
        input.trustConsistency
    )
  );

  const pressure = clamp01(
    input.warningDensity * 0.45 +
      input.recruiterSuspicionRisk * 0.25 +
      (1 - input.governanceHealth) * 0.15 +
      (1 - input.realismScore) * 0.15
  );

  const mode: TempoOutput["mode"] =
    pressure >= 0.75
      ? "recovery"
      : pressure >= 0.55
        ? "stabilizing"
        : pressure >= 0.3
          ? "balanced"
          : "accelerated";

  const modeVelocityFactor =
    mode === "accelerated"
      ? 1
      : mode === "balanced"
        ? 0.82
        : mode === "stabilizing"
          ? 0.58
          : 0.35;

  const normalizedVelocity = clamp01(adaptationVelocity * modeVelocityFactor);

  const mutationCooldownMs = Math.round(
    1500 +
      (1 - normalizedVelocity) * 6500 +
      pressure * 2500
  );

  const explorationBreadth = Number(
    clamp01(
      normalizedVelocity * (1 - pressure * 0.35)
    ).toFixed(4)
  );

  const stabilizationBias = Number(
    clamp01(
      pressure * 0.7 + (1 - normalizedVelocity) * 0.3
    ).toFixed(4)
  );

  return {
    adaptationVelocity: Number(normalizedVelocity.toFixed(4)),
    mutationCooldownMs,
    explorationBreadth,
    stabilizationBias,
    mode,
  };
}
