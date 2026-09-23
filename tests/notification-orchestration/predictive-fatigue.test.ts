import test from "node:test";
import assert from "node:assert/strict";
import { predictFatigue, type FatigueInputs } from "../../lib/ui/predictiveFatigueModel.ts";

function approxEqual(actual: number, expected: number, tolerance = 0.0001): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

test("Low risk profile stays in normal mode without downshift", () => {
  const input: FatigueInputs = {
    ignoredNotificationRate: 0.05,
    actionDelayTrend: 0.1,
    refinementLoopCount: 1,
    sessionVolatility: 0.1,
    interruptionSensitivity: 0.15,
    recoveryFrequency: 0.1,
  };

  const prediction = predictFatigue(input);

  assert.equal(prediction.recommendedInteractionMode, "normal");
  assert.equal(prediction.proactiveDownshiftRequired, false);
  assert.ok(prediction.predictedOverloadWindow >= 40);
});

test("Moderate fatigue profile shifts to reduced mode", () => {
  const input: FatigueInputs = {
    ignoredNotificationRate: 0.35,
    actionDelayTrend: 0.45,
    refinementLoopCount: 3,
    sessionVolatility: 0.4,
    interruptionSensitivity: 0.35,
    recoveryFrequency: 0.3,
  };

  const prediction = predictFatigue(input);

  assert.equal(prediction.recommendedInteractionMode, "reduced");
  assert.equal(prediction.proactiveDownshiftRequired, false);
  assert.ok(prediction.fatigueRisk >= 0.34 && prediction.fatigueRisk < 0.58);
});

test("High fatigue profile triggers quiet mode and proactive downshift", () => {
  const input: FatigueInputs = {
    ignoredNotificationRate: 0.7,
    actionDelayTrend: 0.72,
    refinementLoopCount: 6,
    sessionVolatility: 0.65,
    interruptionSensitivity: 0.8,
    recoveryFrequency: 0.6,
  };

  const prediction = predictFatigue(input);

  assert.equal(prediction.recommendedInteractionMode, "quiet");
  assert.equal(prediction.proactiveDownshiftRequired, true);
  assert.ok(prediction.predictedOverloadWindow <= 35);
});

test("Severe fatigue profile enters recovery mode with short overload window", () => {
  const input: FatigueInputs = {
    ignoredNotificationRate: 0.95,
    actionDelayTrend: 0.9,
    refinementLoopCount: 10,
    sessionVolatility: 0.9,
    interruptionSensitivity: 0.95,
    recoveryFrequency: 0.85,
  };

  const prediction = predictFatigue(input);

  assert.equal(prediction.recommendedInteractionMode, "recovery");
  assert.equal(prediction.proactiveDownshiftRequired, true);
  assert.ok(prediction.predictedOverloadWindow <= 20);
  assert.ok(prediction.fatigueRisk >= 0.78);
});

test("Recovery frequency contributes to earlier overload prediction", () => {
  const baseInput: FatigueInputs = {
    ignoredNotificationRate: 0.4,
    actionDelayTrend: 0.35,
    refinementLoopCount: 4,
    sessionVolatility: 0.4,
    interruptionSensitivity: 0.4,
    recoveryFrequency: 0.1,
  };

  const lowRecovery = predictFatigue(baseInput);
  const highRecovery = predictFatigue({ ...baseInput, recoveryFrequency: 0.9 });

  assert.ok(highRecovery.fatigueRisk > lowRecovery.fatigueRisk);
  assert.ok(highRecovery.predictedOverloadWindow < lowRecovery.predictedOverloadWindow);
});

test("Risk scoring remains deterministic for stable inputs", () => {
  const input: FatigueInputs = {
    ignoredNotificationRate: 0.2,
    actionDelayTrend: 0.3,
    refinementLoopCount: 2,
    sessionVolatility: 0.25,
    interruptionSensitivity: 0.3,
    recoveryFrequency: 0.2,
  };

  const one = predictFatigue(input);
  const two = predictFatigue(input);

  assert.equal(approxEqual(one.fatigueRisk, two.fatigueRisk), true);
  assert.equal(one.recommendedInteractionMode, two.recommendedInteractionMode);
  assert.equal(one.proactiveDownshiftRequired, two.proactiveDownshiftRequired);
  assert.equal(one.predictedOverloadWindow, two.predictedOverloadWindow);
});
