import test from "node:test";
import assert from "node:assert/strict";
import { decideDeliveryAction, type DeliveryDecisionInput } from "../../lib/ui/notificationDecisionEngine.ts";

function baseInput(overrides: Partial<DeliveryDecisionInput> = {}): DeliveryDecisionInput {
  return {
    notification: {
      type: "job_match",
      priority: "normal",
      metadata: {},
    },
    pressureState: "balanced",
    toneConfig: {
      batchingStrategy: "grouped",
      simultaneousLimit: 2,
      digestInterval: 30,
    },
    userFatigue: 0.2,
    recentCount: 0,
    now: new Date("2026-05-18T10:00:00.000Z"),
    ...overrides,
  };
}

test("Deliver now: high urgency + balanced state + low fatigue + no batching", () => {
  const input = baseInput({
    notification: { type: "opportunity", priority: "high", metadata: {} },
    pressureState: "balanced",
    toneConfig: {
      batchingStrategy: "grouped",
      simultaneousLimit: 2,
      digestInterval: 30,
    },
    userFatigue: 0.1,
    recentCount: 0,
  });

  const decision = decideDeliveryAction(input);

  assert.equal(decision.action, "deliver_now");
});

test("Batch: stabilizing state + moderate fatigue + grouped notifications", () => {
  const input = baseInput({
    notification: { type: "suggestion", priority: "normal", metadata: {} },
    pressureState: "stabilizing",
    toneConfig: {
      batchingStrategy: "grouped",
      simultaneousLimit: 1,
      digestInterval: 60,
    },
    userFatigue: 0.5,
    recentCount: 1,
  });

  const decision = decideDeliveryAction(input);

  assert.equal(decision.action, "batch");
});

test("Digest: recovery state + rising pressure + low urgency", () => {
  const input = baseInput({
    notification: {
      type: "status_update",
      priority: "low",
      metadata: { pressureTrend: "rising" },
    },
    pressureState: "recovery",
    toneConfig: {
      batchingStrategy: "digest",
      simultaneousLimit: 0,
      digestInterval: 120,
    },
    userFatigue: 0.6,
    recentCount: 0,
  });

  const decision = decideDeliveryAction(input);

  assert.equal(decision.action, "digest");
});

test("Suppress: locked state + high fatigue + non-critical notification", () => {
  const input = baseInput({
    notification: { type: "tip", priority: "normal", metadata: {} },
    pressureState: "locked",
    toneConfig: {
      batchingStrategy: "suppressed",
      simultaneousLimit: 0,
      digestInterval: 240,
    },
    userFatigue: 0.9,
    recentCount: 2,
  });

  const decision = decideDeliveryAction(input);

  assert.equal(decision.action, "suppress");
});

test("Critical continuity override: bypass suppression in locked state", () => {
  const input = baseInput({
    notification: {
      type: "continuity_event",
      priority: "normal",
      metadata: { continuityCritical: true },
    },
    pressureState: "locked",
    toneConfig: {
      batchingStrategy: "suppressed",
      simultaneousLimit: 0,
      digestInterval: 240,
    },
    userFatigue: 0.95,
    recentCount: 3,
  });

  const decision = decideDeliveryAction(input);

  assert.equal(decision.action, "deliver_now");
});
