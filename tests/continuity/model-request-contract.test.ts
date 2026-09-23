import { test } from "node:test";
import assert from "node:assert";
import {
  buildModelPayload,
} from "../../lib/ai/executeModelRequest.ts";

const messages = [
  {
    role: "user",
    content: "Review this CV.",
  },
];

test("internal telemetry is not sent as metadata when storage is disabled", () => {
  const payload = buildModelPayload({
    model: "gpt-test",
    messages,
    telemetry: {
      intelligenceDomain: "cv",
      intelligenceVersion: "test",
    },
    request: {
      store: false,
    },
  });

  assert.equal(payload.store, false);
  assert.equal("metadata" in payload, false);
});

test("request metadata is removed when remote storage is not explicitly enabled", () => {
  const payload = buildModelPayload({
    model: "gpt-test",
    messages,
    request: {
      metadata: {
        source: "caller",
      },
    },
  });

  assert.equal("metadata" in payload, false);
});

test("telemetry becomes metadata only when remote storage is explicitly enabled", () => {
  const payload = buildModelPayload({
    model: "gpt-test",
    messages,
    telemetry: {
      intelligenceDomain: "cv",
    },
    request: {
      store: true,
      metadata: {
        source: "caller",
      },
    },
  });

  assert.deepEqual(payload.metadata, {
    source: "caller",
    intelligenceDomain: "cv",
  });
});
