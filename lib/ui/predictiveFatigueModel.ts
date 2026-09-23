export type FatigueInputs = {
  ignoredNotificationRate: number;
  actionDelayTrend: number;
  refinementLoopCount: number;
  sessionVolatility: number;
  interruptionSensitivity: number;
  recoveryFrequency: number;
};

export type FatiguePrediction = {
  fatigueRisk: number;
  predictedOverloadWindow: number;
  proactiveDownshiftRequired: boolean;
  recommendedInteractionMode: "normal" | "reduced" | "quiet" | "recovery";
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeLoopCount(loopCount: number): number {
  // More than 8 loops in a short period is treated as maximum exhaustion signal.
  return clamp01(loopCount / 8);
}

function modeFromRisk(risk: number): FatiguePrediction["recommendedInteractionMode"] {
  if (risk >= 0.78) return "recovery";
  if (risk >= 0.6) return "quiet";
  if (risk >= 0.34) return "reduced";
  return "normal";
}

export function predictFatigue(inputs: FatigueInputs): FatiguePrediction {
  const ignored = clamp01(inputs.ignoredNotificationRate);
  const delayTrend = clamp01(inputs.actionDelayTrend);
  const loops = normalizeLoopCount(inputs.refinementLoopCount);
  const volatility = clamp01(inputs.sessionVolatility);
  const sensitivity = clamp01(inputs.interruptionSensitivity);
  const recovery = clamp01(inputs.recoveryFrequency);

  const fatigueRisk = clamp01(
    ignored * 0.24 +
      delayTrend * 0.2 +
      loops * 0.16 +
      volatility * 0.16 +
      sensitivity * 0.14 +
      recovery * 0.1
  );

  const recommendedInteractionMode = modeFromRisk(fatigueRisk);

  // Hours to predicted overload; lower means urgency to reduce pressure now.
  const predictedOverloadWindow = Math.max(2, Math.round(72 - fatigueRisk * 64));

  const proactiveDownshiftRequired =
    fatigueRisk >= 0.58 || recommendedInteractionMode === "quiet" || recommendedInteractionMode === "recovery";

  return {
    fatigueRisk,
    predictedOverloadWindow,
    proactiveDownshiftRequired,
    recommendedInteractionMode,
  };
}
