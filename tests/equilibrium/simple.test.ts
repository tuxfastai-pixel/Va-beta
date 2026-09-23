import { test } from "node:test"
import assert from "node:assert"

test("Basic test: system loads", async () => {
  try {
    const {
      computeEquilibriumState,
    } = await import("../../lib/governance/autonomousEquilibriumController.ts")
    assert(typeof computeEquilibriumState === "function", "Should export computeEquilibriumState")
  } catch (e) {
    console.error("Import error:", e)
    throw e
  }
})
