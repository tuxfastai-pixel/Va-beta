export type InertiaInputs = {
  stabilityAge: number;
  recruiterTrustScore: number;
  alignmentConsistency: number;
  realismPersistence: number;
  identityFragmentationRisk: number;
};

export type InertiaOutput = {
  mutationResistance: number;
  maxAllowedDrift: number;
  inertiaState: "fluid" | "anchored" | "locked";
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function computeBehavioralInertia(input: InertiaInputs): InertiaOutput {
  const normalizedAge = clamp01(input.stabilityAge / 30);
  const resistanceBase =
    (normalizedAge +
      clamp01(input.recruiterTrustScore) +
      clamp01(input.realismPersistence)) /
    3;

  const fragmentationPenalty = clamp01(input.identityFragmentationRisk) * 0.35;
  const consistencyLift = clamp01(input.alignmentConsistency) * 0.15;

  const mutationResistance = Number(
    clamp01(resistanceBase + consistencyLift - fragmentationPenalty).toFixed(4)
  );

  const inertiaState: InertiaOutput["inertiaState"] =
    mutationResistance >= 0.82
      ? "locked"
      : mutationResistance >= 0.55
        ? "anchored"
        : "fluid";

  const stateDriftFactor = inertiaState === "locked" ? 0.35 : inertiaState === "anchored" ? 0.6 : 1;
  const maxAllowedDrift = Number(
    Math.max(0.05, (1 - mutationResistance) * 0.45 * stateDriftFactor + 0.05).toFixed(4)
  );

  return {
    mutationResistance,
    maxAllowedDrift,
    inertiaState,
  };
}
