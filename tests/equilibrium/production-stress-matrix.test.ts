import { test } from "node:test"
import assert from "node:assert"
import { aggregateEquilibriumEvents, type EquilibriumAggregation } from "../../lib/telemetry/equilibriumAggregator.ts"
import type { EquilibriumEvent } from "../../lib/telemetry/equilibriumEventStream.ts"
import { evaluateAutonomousRollback } from "../../lib/governance/autonomousRollback.ts"
import { DEFAULT_DEPLOYMENT_SAFETY_CONFIG } from "../../lib/governance/deploymentSafety.ts"

function buildEvent(index: number, overrides: Partial<EquilibriumEvent> = {}): EquilibriumEvent {
  return {
    userId: `user-${index % 1000}`,
    timestamp: Date.now() - (2000 - index) * 1000,
    eventType: "equilibrium_transition",
    previousState: "balanced",
    nextState: "stabilizing",
    pressureLevel: 0.6,
    fatigueRisk: 0.55,
    recoveryTriggered: false,
    metadata: {},
    ...overrides,
  }
}

function generateTransitionWave(count: number, spacingMs: number, options?: { oscillating?: boolean }): EquilibriumEvent[] {
  const events: EquilibriumEvent[] = []
  const start = Date.now() - count * spacingMs

  for (let i = 0; i < count; i += 1) {
    const oscillating = options?.oscillating ?? false
    const state = oscillating ? (i % 2 === 0 ? "recovery" : "accelerated") : "stabilizing"
    events.push(
      buildEvent(i, {
        timestamp: start + i * spacingMs,
        previousState: i % 3 === 0 ? "balanced" : "stabilizing",
        nextState: state,
        fatigueRisk: oscillating ? 0.78 : 0.58,
        pressureLevel: oscillating ? 0.82 : 0.6,
      }),
    )
  }

  return events
}

test("Stress matrix: 1,000 concurrent users aggregation remains stable", () => {
  const events: EquilibriumEvent[] = []
  for (let i = 0; i < 4000; i += 1) {
    events.push(buildEvent(i, { userId: `user-${i % 1000}` }))
  }

  const aggregation = aggregateEquilibriumEvents(events)
  assert.equal(aggregation.totals.uniqueUsers, 1000)
  assert.equal(aggregation.totals.eventCount, 4000)
})

test("Stress matrix: 24h adaptation durability keeps anomaly profile controlled", () => {
  const events = generateTransitionWave(96, 15 * 60 * 1000)
  const aggregation = aggregateEquilibriumEvents(events)

  assert(aggregation.transitions.frequencyPerHour <= 4.2, "Transition frequency should remain moderate over long windows")
  assert(aggregation.anomalies.length <= 2, "Durability run should not produce widespread anomalies")
})

test("Stress matrix: repeated recovery cycles surface oscillation anomaly", () => {
  const events = generateTransitionWave(800, 12_000, { oscillating: true })
  const aggregation = aggregateEquilibriumEvents(events)

  assert(
    aggregation.anomalies.some((anomaly) => anomaly.kind === "oscillation"),
    "Rapid alternating recovery cycles should be detected as oscillation",
  )
})

test("Stress matrix: heavy suppression with weak continuity triggers rollback", () => {
  const events: EquilibriumEvent[] = []
  for (let i = 0; i < 300; i += 1) {
    events.push(buildEvent(i, { eventType: "fatigue_prediction", fatigueRisk: 0.85, pressureLevel: 0.84 }))
  }
  for (let i = 300; i < 360; i += 1) {
    events.push(buildEvent(i, { eventType: "notification_suppression", fatigueRisk: 0.85, pressureLevel: 0.84 }))
  }
  const aggregation: EquilibriumAggregation = aggregateEquilibriumEvents(events)
  const decision = evaluateAutonomousRollback(
    aggregation,
    {
      ...DEFAULT_DEPLOYMENT_SAFETY_CONFIG,
      updatedAt: new Date(),
    },
  )

  assert.equal(decision.triggered, true)
  assert.equal(decision.nextConfig.forceBalancedMode, true)
  assert.equal(decision.nextConfig.forceQuietNotifications, true)
})

test("Stress matrix: rapid transition storms trigger rollback safeguards", () => {
  const events = generateTransitionWave(900, 2_000, { oscillating: true })
  const aggregation = aggregateEquilibriumEvents(events)
  const decision = evaluateAutonomousRollback(
    aggregation,
    {
      ...DEFAULT_DEPLOYMENT_SAFETY_CONFIG,
      updatedAt: new Date(),
    },
  )

  assert.equal(decision.triggered, true)
  assert(
    decision.nextConfig.safeMode || decision.nextConfig.emergencyRollback,
    "Rapid transition storms should escalate to safety mode",
  )
})
