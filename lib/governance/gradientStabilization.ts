export type GradientInputs = {
  warningHistory: number[];
  riskHistory: number[];
  driftHistory: number[];
};

export type GradientOutput = {
  instabilityAcceleration: number;
  projectedStressWindow: number;
  stabilizationRequired: boolean;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function accelerationSignal(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const latest = values[values.length - 1] ?? 0;
  const previous = values.slice(0, -1);
  const previousAverage =
    previous.length > 0
      ? previous.reduce((sum, value) => sum + value, 0) / previous.length
      : latest;

  return clamp01(latest - previousAverage);
}

export function evaluateGradientStabilization(input: GradientInputs): GradientOutput {
  const warningAcceleration = accelerationSignal(input.warningHistory);
  const riskAcceleration = accelerationSignal(input.riskHistory);
  const driftAcceleration = accelerationSignal(input.driftHistory);

  const instabilityAcceleration = Number(
    clamp01(
      warningAcceleration * 0.45 +
        riskAcceleration * 0.35 +
        driftAcceleration * 0.2
    ).toFixed(4)
  );

  const projectedStressWindow = Number(
    Math.max(1, 12 - instabilityAcceleration * 10).toFixed(2)
  );

  return {
    instabilityAcceleration,
    projectedStressWindow,
    stabilizationRequired: instabilityAcceleration >= 0.3 || projectedStressWindow <= 4,
  };
}
