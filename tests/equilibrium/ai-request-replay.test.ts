import { test } from "node:test";
import assert from "node:assert";
import { buildModelPayload } from "../../lib/ai/executeModelRequest.ts";

test("AI request gateway normalizes composite reconstructed payloads", () => {
  const reconstructedHistory = [
    {
      id: "thinking_0",
      role: "assistant",
      content: [{ type: "output_text", text: "Internal reasoning trace should be flattened." }],
      telemetry: { unsafe: true },
    },
    {
      id: "msg_1",
      role: "user",
      content: "Continue with governance-safe adaptation.",
      annotations: { governance: "tighten" },
    },
    {
      id: "msg_2",
      role: "tool",
      content: "Unsupported tool role should be removed.",
    },
    {
      id: "msg_3",
      role: "developer",
      content: "Apply equilibrium continuity constraints.",
    },
  ];

  const payload = buildModelPayload({
    model: "gpt-4o-mini",
    messages: reconstructedHistory,
    telemetry: {
      requestKind: "composite-replay",
      sessionId: "sess-1",
      unstable: false,
      droppedComplexField: { nested: true },
    },
    request: {
      metadata: { existing: "kept" },
      tools: [
        { type: "function", function: { name: "safe_tool", description: "safe", parameters: { type: "object" } } },
        { type: "file_search", command: "rm -rf" },
      ],
    },
  });

  assert.equal(payload.model, "gpt-4o-mini");
  assert(Array.isArray(payload.messages));

  const messages = payload.messages as Array<{ role: string; content: string; id?: string }>;
  assert.equal(messages.length, 3);
  assert(messages.every((m) => m.role === "assistant" || m.role === "user" || m.role === "developer" || m.role === "system"));
  assert(messages.every((m) => typeof m.content === "string" && m.content.length > 0));
  assert(messages.every((m) => !("id" in m)));

  assert(Array.isArray(payload.tools));
  const tools = payload.tools as Array<{ type: string; function?: { name?: string } }>;
  assert.equal(tools.length, 1);
  assert.equal(tools[0].type, "function");
  assert.equal(tools[0].function?.name, "safe_tool");

  const metadata = payload.metadata as Record<string, unknown>;
  assert.equal(metadata.existing, "kept");
  assert.equal(metadata.requestKind, "composite-replay");
  assert.equal(metadata.sessionId, "sess-1");
  assert.equal(metadata.unstable, false);
  assert(!("droppedComplexField" in metadata));
});

test("AI request gateway enforces message contract", () => {
  assert.throws(() => {
    buildModelPayload({
      model: "gpt-4o-mini",
      messages: [{ role: "tool", content: "unsupported" }],
    });
  }, /Message contract violation/);
});
