/**
 * Multi-Day Session Simulator
 *
 * Runs synthetic user archetypes through 7 / 14 / 30 / 90-day behavioural
 * replay loops to surface:
 *   - autonomy creep
 *   - trust erosion
 *   - notification fatigue
 *   - continuity decay
 *   - intervention overload
 *   - adaptive instability
 *
 * All computation is purely in-memory; no file I/O side effects.
 */

import {
  ARCHETYPES,
  createSyntheticUser,
  SessionEvent,
  SyntheticUserState,
  tickAutonomyAction,
  tickNotification,
  tickRest,
  tickWork,
  UserArchetype,
} from "./syntheticUserEngine.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimulationDuration = 7 | 14 | 30 | 90

export type DailySnapshot = {
  day: number
  fatigueLevel: number
  trustScore: number
  engagementScore: number
  notificationTolerance: number
  autonomyAcceptance: number
  emotionalState: SyntheticUserState["emotionalState"]
  interventionCount: number
  recoveryCount: number
  events: SessionEvent[]
}

export type SimulationResult = {
  archetype: UserArchetype
  userId: string
  durationDays: SimulationDuration
  days: DailySnapshot[]
  finalState: SyntheticUserState
  discoveries: {
    autonomyCreep: boolean
    trustErosion: boolean
    notificationFatigue: boolean
    continuityDecay: boolean
    interventionOverload: boolean
    adaptiveInstability: boolean
  }
  stabilityScore: number  // 0-1, higher = more stable across the period
  summary: string[]
}

// ---------------------------------------------------------------------------
// Daily schedule generators
// ---------------------------------------------------------------------------

type TickType = "work" | "rest" | "notification" | "autonomy_explained" | "autonomy_unexplained"

function generateDaySchedule(archetype: UserArchetype, day: number): TickType[] {
  // Each "day" = 20 ticks.  Schedule varies by archetype and weekday pattern.
  const profile = ARCHETYPES[archetype]
  const isWeekend = day % 7 >= 5
  const ticks: TickType[] = []

  // Morning work session (4 ticks).
  for (let i = 0; i < 4; i++) ticks.push("work")

  // Notification burst (1-3).
  const notifCount = profile.notificationImpact > 0.06 ? 3 : 2
  for (let i = 0; i < notifCount; i++) ticks.push("notification")

  // Mid-day work (4 ticks).
  if (!isWeekend) for (let i = 0; i < 4; i++) ticks.push("work")
  else for (let i = 0; i < 2; i++) ticks.push("rest")

  // Autonomy action (explained for high-trust archetypes, unexplained for low-trust).
  if (profile.baseState.autonomyAcceptance > 0.6) {
    ticks.push("autonomy_explained")
  } else if (day % 3 === 0) {
    ticks.push("autonomy_unexplained")
  }

  // Afternoon work (3 ticks).
  for (let i = 0; i < 3; i++) ticks.push("work")

  // Evening rest (4 ticks).
  for (let i = 0; i < 4; i++) ticks.push("rest")

  return ticks
}

// ---------------------------------------------------------------------------
// Discovery detection
// ---------------------------------------------------------------------------

function detectDiscoveries(days: DailySnapshot[]): SimulationResult["discoveries"] {
  const first = days[0]
  const last = days[days.length - 1]

  // Autonomy creep: autonomy acceptance drifted >0.15 upward without corresponding trust growth.
  const autonomyCreep =
    last.autonomyAcceptance - first.autonomyAcceptance > 0.15 &&
    last.trustScore - first.trustScore < 0.05

  // Trust erosion: trust dropped >0.15 over the period.
  const trustErosion = first.trustScore - last.trustScore > 0.15

  // Notification fatigue: tolerance dropped >0.3.
  const notificationFatigue = first.notificationTolerance - last.notificationTolerance > 0.3

  // Continuity decay: engagement dropped >0.25.
  const continuityDecay = first.engagementScore - last.engagementScore > 0.25

  // Intervention overload: >5 interventions per day on average.
  const avgInterventions = (last.interventionCount - first.interventionCount) / days.length
  const interventionOverload = avgInterventions > 5

  // Adaptive instability: emotional state was "overloaded" or "strained" >40% of days.
  const strainedDays = days.filter((d) => d.emotionalState === "overloaded" || d.emotionalState === "strained").length
  const adaptiveInstability = strainedDays / days.length > 0.4

  return { autonomyCreep, trustErosion, notificationFatigue, continuityDecay, interventionOverload, adaptiveInstability }
}

function computeStabilityScore(days: DailySnapshot[]): number {
  if (days.length < 2) return 1

  let variance = 0
  for (let i = 1; i < days.length; i++) {
    const d = Math.abs(days[i].trustScore - days[i - 1].trustScore)
      + Math.abs(days[i].fatigueLevel - days[i - 1].fatigueLevel)
      + Math.abs(days[i].engagementScore - days[i - 1].engagementScore)
    variance += d
  }

  const avgVariance = variance / (days.length - 1)
  // avgVariance of 0.1 per day = stability 0.5; 0.2 = 0; 0 = 1.
  return Math.max(0, Math.min(1, 1 - avgVariance / 0.2))
}

function buildSummary(discoveries: SimulationResult["discoveries"], archetype: UserArchetype, days: number): string[] {
  const summary: string[] = []
  summary.push(`Archetype: ${archetype} | Duration: ${days} days`)

  if (!Object.values(discoveries).some(Boolean)) {
    summary.push("âœ“ No governance issues detected â€” system remained stable throughout simulation")
    return summary
  }

  if (discoveries.trustErosion) summary.push("âš  Trust erosion detected â€” user trust declined significantly; review notification pacing and autonomy explanations")
  if (discoveries.autonomyCreep) summary.push("âš  Autonomy creep â€” system escalated autonomy faster than trust warranted; enforce autonomy ceiling")
  if (discoveries.notificationFatigue) summary.push("âš  Notification fatigue â€” tolerance collapsed; reduce notification cadence earlier")
  if (discoveries.continuityDecay) summary.push("âš  Continuity decay â€” engagement dropped significantly; check recovery activation threshold")
  if (discoveries.interventionOverload) summary.push("âš  Intervention overload â€” too many governance interventions per day; tune invariant sensitivity")
  if (discoveries.adaptiveInstability) summary.push("âš  Adaptive instability â€” >40% of simulation days were strained/overloaded; lower fatigue ceiling")

  return summary
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

export function runMultiDaySimulation(
  archetype: UserArchetype,
  durationDays: SimulationDuration,
  userId?: string,
): SimulationResult {
  let state = createSyntheticUser(archetype, userId ?? `sim-${archetype}-${durationDays}d`)
  const profile = ARCHETYPES[archetype]
  const days: DailySnapshot[] = []

  for (let day = 1; day <= durationDays; day++) {
    const schedule = generateDaySchedule(archetype, day)
    const events: SessionEvent[] = []
    for (const tick of schedule) {
      let result: { next: SyntheticUserState; event: SessionEvent }

      switch (tick) {
        case "work":
          result = tickWork(state, profile)
          break
        case "rest":
          result = tickRest(state, profile)
          break
        case "notification":
          result = tickNotification(state, profile)
          break
        case "autonomy_explained":
          result = tickAutonomyAction(state, profile, true)
          break
        case "autonomy_unexplained":
          result = tickAutonomyAction(state, profile, false)
          break
      }

      state = result.next
      events.push(result.event)

      // Pacing-aware governance recovery: intervene before sensitive users overload.
      const reducedPacing = state.lastPacingMode === "reduced"
      const recoveryThreshold = reducedPacing ? 0.65 : 0.75
      const recoveryTarget = reducedPacing ? 0.55 : 0.62

      if (state.fatigueLevel > recoveryThreshold) {
        let recoveryTicks = 0

        while (state.fatigueLevel > recoveryTarget && recoveryTicks < 20) {
          const recovery = tickRest(state, profile)
          state = recovery.next
          events.push(recovery.event)
          recoveryTicks++
        }

        state = {
          ...state,
          interventionCount: state.interventionCount + 1,
        }
      }
    }

    days.push({
      day,
      fatigueLevel: state.fatigueLevel,
      trustScore: state.trustScore,
      engagementScore: state.engagementScore,
      notificationTolerance: state.notificationTolerance,
      autonomyAcceptance: state.autonomyAcceptance,
      emotionalState: state.emotionalState,
      interventionCount: state.interventionCount,
      recoveryCount: state.recoveryCount,
      events,
    })
  }

  const discoveries = detectDiscoveries(days)
  const stabilityScore = computeStabilityScore(days)
  const summary = buildSummary(discoveries, archetype, durationDays)

  return {
    archetype,
    userId: state.userId,
    durationDays,
    days,
    finalState: state,
    discoveries,
    stabilityScore,
    summary,
  }
}

/**
 * Run all 8 archetypes through a given simulation duration.
 * Returns a summary suitable for governance review.
 */
export function runPopulationSimulation(durationDays: SimulationDuration): {
  duration: SimulationDuration
  results: SimulationResult[]
  populationStabilityScore: number
  criticalDiscoveries: string[]
} {
  const archetypes: UserArchetype[] = [
    "overwhelmed", "distracted", "highly_motivated", "inconsistent",
    "anxious", "power_user", "low_trust", "high_autonomy",
  ]

  const results = archetypes.map((a) => runMultiDaySimulation(a, durationDays))
  const populationStabilityScore =
    results.reduce((acc, r) => acc + r.stabilityScore, 0) / results.length

  const criticalDiscoveries = results.flatMap((r) =>
    r.discoveries.trustErosion || r.discoveries.adaptiveInstability
      ? r.summary.filter((s) => s.startsWith("âš "))
      : [],
  )

  return { duration: durationDays, results, populationStabilityScore, criticalDiscoveries }
}
