export type NotificationToneInputs = {
  systemGuidanceState: string;
  momentum: string;
  stabilityOfDirection: string;
  recoveryFrequency: number;
  instabilityAcceleration: number;
};

export type NotificationToneOutput = {
  notificationDensity: "high" | "normal" | "low" | "minimal";
  urgencyStyle: "proactive" | "informative" | "quiet" | "essential";
  batchingStrategy: "instant" | "grouped" | "digest";
  interruptionTolerance: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pressureTier(inputs: NotificationToneInputs): "high" | "medium" | "low" {
  const guidanceState = inputs.systemGuidanceState.toLowerCase();
  const momentum = inputs.momentum.toLowerCase();
  const stability = inputs.stabilityOfDirection.toLowerCase();
  const recovery = clamp01(inputs.recoveryFrequency);
  const acceleration = clamp01(inputs.instabilityAcceleration);

  const statePressure =
    guidanceState.includes("holding steady") ||
    guidanceState.includes("direction secured") ||
    guidanceState.includes("careful alignment")
      ? 0.78
      : guidanceState.includes("stable")
        ? 0.25
        : guidanceState.includes("active")
          ? 0.15
          : 0.4;

  const momentumPressure = momentum.includes("careful") ? 0.6 : momentum.includes("strong") ? 0.15 : 0.35;
  const stabilityPressure =
    stability.includes("needs gentle refinement") || stability.includes("stabilizing")
      ? 0.65
      : stability.includes("highly consistent")
        ? 0.2
        : 0.35;

  const pressure = clamp01(
    statePressure * 0.35 +
    recovery * 0.25 +
    acceleration * 0.25 +
    momentumPressure * 0.1 +
    stabilityPressure * 0.05
  );

  if (pressure >= 0.62) return "high";
  if (pressure >= 0.38) return "medium";
  return "low";
}

export function computeNotificationTone(inputs: NotificationToneInputs): NotificationToneOutput {
  const guidanceState = inputs.systemGuidanceState.toLowerCase();
  const tier = pressureTier(inputs);

  if (guidanceState.includes("direction secured")) {
    return {
      notificationDensity: "minimal",
      urgencyStyle: "essential",
      batchingStrategy: "digest",
      interruptionTolerance: 0.05,
    };
  }

  if (guidanceState.includes("holding steady")) {
    return {
      notificationDensity: "minimal",
      urgencyStyle: "essential",
      batchingStrategy: "digest",
      interruptionTolerance: 0.08,
    };
  }

  if (guidanceState.includes("careful alignment") || guidanceState.includes("adapting carefully") || tier === "high") {
    return {
      notificationDensity: "low",
      urgencyStyle: "quiet",
      batchingStrategy: "digest",
      interruptionTolerance: 0.2,
    };
  }

  if (guidanceState.includes("active refinement") || guidanceState.includes("actively refining")) {
    return {
      notificationDensity: tier === "medium" ? "normal" : "high",
      urgencyStyle: "proactive",
      batchingStrategy: tier === "medium" ? "grouped" : "instant",
      interruptionTolerance: tier === "medium" ? 0.58 : 0.74,
    };
  }

  return {
    notificationDensity: tier === "medium" ? "low" : "normal",
    urgencyStyle: "informative",
    batchingStrategy: tier === "medium" ? "digest" : "grouped",
    interruptionTolerance: tier === "medium" ? 0.32 : 0.46,
  };
}
