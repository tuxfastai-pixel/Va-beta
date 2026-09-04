import { test } from "node:test"
import assert from "node:assert"
import {
  isFeatureEnabledForUser,
  isShadowModeForUser,
  type FeatureRolloutPolicy,
} from "../../lib/governance/featureRollout.ts"

const basePolicy: FeatureRolloutPolicy = {
  featureKey: "adaptive-regulation-v1",
  enabled: true,
  mode: "shadow-mode",
  percentage: 100,
  allowedCohorts: [],
  internalUserIds: [],
}

test("Shadow mode targets user for observation but does not enable live feature application", () => {
  const context = { userId: "shadow-user" }

  assert.equal(isShadowModeForUser(basePolicy, context), true)
  assert.equal(isFeatureEnabledForUser(basePolicy, context), false)
})

test("Non-shadow rollout mode does not report shadow mode activation", () => {
  const policy: FeatureRolloutPolicy = {
    ...basePolicy,
    mode: "percentage",
  }

  assert.equal(isShadowModeForUser(policy, { userId: "normal-user" }), false)
  assert.equal(isFeatureEnabledForUser(policy, { userId: "normal-user" }), true)
})
