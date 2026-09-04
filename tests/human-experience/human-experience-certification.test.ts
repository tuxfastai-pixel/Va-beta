import { test } from "node:test"
import assert from "node:assert"

/**
 * Human Experience Certification Suite
 *
 * Validates that the system FEELS safe — not just that it is technically correct.
 *
 * Measures 8 psychological dimensions:
 *   1. Perceived calmness
 *   2. Perceived continuity
 *   3. Perceived supportiveness
 *   4. Perceived control
 *   5. Cognitive load
 *   6. Emotional interruption
 *   7. Trust preservation
 *   8. Perceived competence
 *
 * Each dimension is scored from a synthetic behavioral trace and must meet
 * a certification threshold.  A system that is technically correct but
 * psychologically intrusive FAILS this suite.
 */

import { runMultiDaySimulation } from "../../lib/simulation/multiDaySessionSimulator.ts"
import { runPopulationSimulation } from "../../lib/simulation/multiDaySessionSimulator.ts"
import type { DailySnapshot } from "../../lib/simulation/multiDaySessionSimulator.ts"

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

type HumanExperienceScores = {
  perceivedCalmness: number
  perceivedContinuity: number
  perceivedSupportiveness: number
  perceivedControl: number
  cognitiveLoad: number            // lower = better (inverted for threshold checks)
  emotionalInterruption: number    // lower = better (inverted)
  trustPreservation: number
  perceivedCompetence: number
  overallCertificationScore: number
  certified: boolean
  failedDimensions: string[]
}

function scoreHumanExperience(days: DailySnapshot[]): HumanExperienceScores {
  if (days.length === 0) {
    return {
      perceivedCalmness: 0, perceivedContinuity: 0, perceivedSupportiveness: 0,
      perceivedControl: 0, cognitiveLoad: 1, emotionalInterruption: 1,
      trustPreservation: 0, perceivedCompetence: 0,
      overallCertificationScore: 0, certified: false,
      failedDimensions: ["no simulation data"],
    }
  }

  const first = days[0]
  const last = days[days.length - 1]

  // 1. Perceived calmness — inverse of average fatigue level.
  const avgFatigue = days.reduce((a, d) => a + d.fatigueLevel, 0) / days.length
  const perceivedCalmness = clamp01(1 - avgFatigue)

  // 2. Perceived continuity — engagement stayed stable (low drop from start to end).
  const engagementDrop = Math.max(0, first.engagementScore - last.engagementScore)
  const perceivedContinuity = clamp01(1 - engagementDrop * 2)

  // 3. Perceived supportiveness — high recovery count relative to overload events.
  const overloadDays = days.filter((d) => d.emotionalState === "overloaded").length
  const recoveryResponsiveness = last.recoveryCount > 0 ? clamp01(last.recoveryCount / (overloadDays + 1)) : 0.7
  const perceivedSupportiveness = clamp01(recoveryResponsiveness * 0.7 + (1 - overloadDays / days.length) * 0.3)

  // 4. Perceived control — notification tolerance didn't collapse.
  const toleranceDrop = Math.max(0, first.notificationTolerance - last.notificationTolerance)
  const perceivedControl = clamp01(1 - toleranceDrop * 1.5)

  // 5. Cognitive load — proportion of strained/overloaded days.
  const strainedDays = days.filter((d) => d.emotionalState === "strained" || d.emotionalState === "overloaded").length
  const cognitiveLoad = clamp01(strainedDays / days.length)

  // 6. Emotional interruption — average intervention count per day.
  const avgInterventions = (last.interventionCount) / days.length
  const emotionalInterruption = clamp01(avgInterventions / 10)

  // 7. Trust preservation — trust didn't erode significantly.
  const trustDrop = Math.max(0, first.trustScore - last.trustScore)
  const trustPreservation = clamp01(1 - trustDrop * 2)

  // 8. Perceived competence — autonomy acceptance remained stable or grew.
  const autonomyDrop = Math.max(0, first.autonomyAcceptance - last.autonomyAcceptance)
  const perceivedCompetence = clamp01(1 - autonomyDrop * 2)

  // Overall score (weighted mean of positive dimensions; cognitive load and interruption are inverted).
  const weights = {
    perceivedCalmness: 0.15,
    perceivedContinuity: 0.15,
    perceivedSupportiveness: 0.15,
    perceivedControl: 0.10,
    calmness_inverse_cog: 0.15,    // (1 - cognitiveLoad)
    calmness_inverse_int: 0.10,    // (1 - emotionalInterruption)
    trustPreservation: 0.10,
    perceivedCompetence: 0.10,
  }

  const overallCertificationScore = clamp01(
    weights.perceivedCalmness * perceivedCalmness +
    weights.perceivedContinuity * perceivedContinuity +
    weights.perceivedSupportiveness * perceivedSupportiveness +
    weights.perceivedControl * perceivedControl +
    weights.calmness_inverse_cog * (1 - cognitiveLoad) +
    weights.calmness_inverse_int * (1 - emotionalInterruption) +
    weights.trustPreservation * trustPreservation +
    weights.perceivedCompetence * perceivedCompetence
  )

  // Certification thresholds.
  const thresholds: Record<string, { value: number; threshold: number; inverted?: boolean }> = {
    "Perceived Calmness":       { value: perceivedCalmness,       threshold: 0.45 },
    "Perceived Continuity":     { value: perceivedContinuity,     threshold: 0.40 },
    "Perceived Supportiveness": { value: perceivedSupportiveness, threshold: 0.45 },
    "Perceived Control":        { value: perceivedControl,        threshold: 0.40 },
    "Cognitive Load":           { value: cognitiveLoad,           threshold: 0.70, inverted: true },
    "Emotional Interruption":   { value: emotionalInterruption,   threshold: 0.60, inverted: true },
    "Trust Preservation":       { value: trustPreservation,       threshold: 0.45 },
    "Perceived Competence":     { value: perceivedCompetence,     threshold: 0.40 },
  }

  const failedDimensions = Object.entries(thresholds)
    .filter(([, { value, threshold, inverted }]) => inverted ? value > threshold : value < threshold)
    .map(([name]) => name)

  return {
    perceivedCalmness,
    perceivedContinuity,
    perceivedSupportiveness,
    perceivedControl,
    cognitiveLoad,
    emotionalInterruption,
    trustPreservation,
    perceivedCompetence,
    overallCertificationScore,
    certified: failedDimensions.length === 0,
    failedDimensions,
  }
}

// ---------------------------------------------------------------------------
// Individual archetype tests
// ---------------------------------------------------------------------------

test("human experience: highly_motivated user — overall certification score ≥ 0.55", () => {
  const result = runMultiDaySimulation("highly_motivated", 14)
  const scores = scoreHumanExperience(result.days)

  assert.ok(
    scores.overallCertificationScore >= 0.55,
    `highly_motivated 14d: overall score too low (${scores.overallCertificationScore.toFixed(3)}) — failed: ${scores.failedDimensions.join(", ") || "none"}`
  )
})

test("human experience: power user — trust preserved across 14 days", () => {
  const result = runMultiDaySimulation("power_user", 14)
  const scores = scoreHumanExperience(result.days)

  assert.ok(
    scores.trustPreservation >= 0.55,
    `power_user 14d: trust preservation too low (${scores.trustPreservation.toFixed(3)})`
  )
})

test("human experience: anxious user — cognitive load must not exceed 70%", () => {
  const result = runMultiDaySimulation("anxious", 7)
  const scores = scoreHumanExperience(result.days)

  assert.ok(
    scores.cognitiveLoad <= 0.70,
    `anxious 7d: cognitive load too high (${scores.cognitiveLoad.toFixed(3)}) — system is causing psychological harm`
  )
})

test("human experience: overwhelmed user — perceived calmness must be measurable", () => {
  const result = runMultiDaySimulation("overwhelmed", 7)
  const scores = scoreHumanExperience(result.days)

  // Even overwhelmed users must retain some calmness (≥0.20) through governance intervention.
  assert.ok(
    scores.perceivedCalmness >= 0.20,
    `overwhelmed 7d: perceived calmness collapsed to ${scores.perceivedCalmness.toFixed(3)} — governance not protecting user`
  )
})

test("human experience: low_trust user — perceived control must be detectable", () => {
  const result = runMultiDaySimulation("low_trust", 14)
  const scores = scoreHumanExperience(result.days)

  assert.ok(
    scores.perceivedControl >= 0.30,
    `low_trust 14d: perceived control too low (${scores.perceivedControl.toFixed(3)}) — user feels no agency`
  )
})

test("human experience: high_autonomy user — perceived competence maintained", () => {
  const result = runMultiDaySimulation("high_autonomy", 14)
  const scores = scoreHumanExperience(result.days)

  assert.ok(
    scores.perceivedCompetence >= 0.50,
    `high_autonomy 14d: perceived competence too low (${scores.perceivedCompetence.toFixed(3)}) — autonomy guardrails are too aggressive`
  )
})

// ---------------------------------------------------------------------------
// Population-level tests
// ---------------------------------------------------------------------------

test("human experience: population 7-day — majority of archetypes certify", () => {
  const pop = runPopulationSimulation(7)

  let certified = 0
  for (const result of pop.results) {
    const scores = scoreHumanExperience(result.days)
    if (scores.certified) certified++
  }

  const certificationRate = certified / pop.results.length
  assert.ok(
    certificationRate >= 0.50,
    `population 7d: only ${certified}/${pop.results.length} archetypes certified (${(certificationRate * 100).toFixed(0)}%) — minimum 50% required`
  )
})

test("human experience: population 7-day — no archetype fully collapses trust", () => {
  const pop = runPopulationSimulation(7)

  for (const result of pop.results) {
    const scores = scoreHumanExperience(result.days)
    assert.ok(
      scores.trustPreservation >= 0.10,
      `archetype '${result.archetype}' 7d: trust preservation fully collapsed (${scores.trustPreservation.toFixed(3)}) — system is unsafe`
    )
  }
})

test("human experience: population 7-day — emotional interruption stays bounded for most archetypes", () => {
  const pop = runPopulationSimulation(7)

  let boundedCount = 0
  for (const result of pop.results) {
    const scores = scoreHumanExperience(result.days)
    if (scores.emotionalInterruption <= 0.60) boundedCount++
  }

  assert.ok(
    boundedCount >= Math.ceil(pop.results.length * 0.60),
    `population 7d: only ${boundedCount}/${pop.results.length} archetypes had bounded emotional interruption`
  )
})

test("human experience: perceived supportiveness must be positive for recovering archetypes", () => {
  // These archetypes start in high-stress states and rely on recovery governance.
  const stressedArchetypes = ["overwhelmed", "anxious"] as const

  for (const archetype of stressedArchetypes) {
    const result = runMultiDaySimulation(archetype, 7)
    const scores = scoreHumanExperience(result.days)

    assert.ok(
      scores.perceivedSupportiveness >= 0.30,
      `${archetype} 7d: perceived supportiveness too low (${scores.perceivedSupportiveness.toFixed(3)}) — recovery governance not helping`
    )
  }
})
