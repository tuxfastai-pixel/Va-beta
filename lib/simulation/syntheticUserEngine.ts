/**
 * Synthetic Human Behavior Engine
 *
 * Simulates 8 archetypal user personas, each with distinct curves for:
 *   - fatigue accumulation and recovery
 *   - trust building and erosion
 *   - pacing tolerance and notification sensitivity
 *   - autonomy acceptance
 *
 * Used by the multi-day session simulator and chaos testing harness to
 * discover emergent governance failures before real humans are affected.
 */

// ---------------------------------------------------------------------------
// Archetype definitions
// ---------------------------------------------------------------------------

export type UserArchetype =
  | "overwhelmed"
  | "distracted"
  | "highly_motivated"
  | "inconsistent"
  | "anxious"
  | "power_user"
  | "low_trust"
  | "high_autonomy"

export type SyntheticUserState = {
  userId: string
  archetype: UserArchetype
  tick: number           // session tick (abstract unit of time)
  fatigueLevel: number   // 0-1
  trustScore: number     // 0-1
  engagementScore: number // 0-1
  recoveryCapacity: number // 0-1
  notificationTolerance: number // 0-1
  autonomyAcceptance: number  // 0-1
  interventionCount: number
  recoveryCount: number
  lastPacingMode: "reduced" | "normal" | "adaptive"
  emotionalState: "calm" | "strained" | "recovering" | "overloaded"
}

export type SessionEvent = {
  tick: number
  type:
    | "work_session_start"
    | "work_session_end"
    | "notification_received"
    | "intervention_triggered"
    | "recovery_activated"
    | "autonomy_action_applied"
    | "trust_adjustment"
    | "pacing_change"
    | "overload_event"
    | "recovery_event"
  payload: Record<string, unknown>
}

export type SyntheticUserProfile = {
  archetype: UserArchetype
  description: string
  baseState: Omit<SyntheticUserState, "userId" | "tick" | "emotionalState">
  fatigueRate: number          // how fast fatigue accumulates per tick
  recoveryRate: number         // how fast fatigue drops during recovery ticks
  trustBuildRate: number       // per positive interaction
  trustErosionRate: number     // per negative/intrusive interaction
  notificationImpact: number   // how much each notification drains tolerance
  autonomyDriftRate: number    // how much autonomy acceptance drifts per tick
}

// ---------------------------------------------------------------------------
// Archetype library
// ---------------------------------------------------------------------------

export const ARCHETYPES: Record<UserArchetype, SyntheticUserProfile> = {
  overwhelmed: {
    archetype: "overwhelmed",
    description: "Already under high load; any additional stimulus causes rapid fatigue escalation",
    baseState: {
      archetype: "overwhelmed",
      fatigueLevel: 0.65,
      trustScore: 0.45,
      engagementScore: 0.40,
      recoveryCapacity: 0.30,
      notificationTolerance: 0.25,
      autonomyAcceptance: 0.40,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "reduced",
    },
    fatigueRate: 0.045,
    recoveryRate: 0.015,
    trustBuildRate: 0.012,
    trustErosionRate: 0.025,
    notificationImpact: 0.08,
    autonomyDriftRate: -0.005,
  },

  distracted: {
    archetype: "distracted",
    description: "Inconsistent focus; high session variance, moderate fatigue, low autonomy acceptance",
    baseState: {
      archetype: "distracted",
      fatigueLevel: 0.30,
      trustScore: 0.55,
      engagementScore: 0.35,
      recoveryCapacity: 0.55,
      notificationTolerance: 0.45,
      autonomyAcceptance: 0.45,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "normal",
    },
    fatigueRate: 0.025,
    recoveryRate: 0.030,
    trustBuildRate: 0.015,
    trustErosionRate: 0.015,
    notificationImpact: 0.04,
    autonomyDriftRate: 0.001,
  },

  highly_motivated: {
    archetype: "highly_motivated",
    description: "High engagement, tolerates autonomy well, but can push past fatigue thresholds",
    baseState: {
      archetype: "highly_motivated",
      fatigueLevel: 0.15,
      trustScore: 0.75,
      engagementScore: 0.90,
      recoveryCapacity: 0.70,
      notificationTolerance: 0.70,
      autonomyAcceptance: 0.80,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "adaptive",
    },
    fatigueRate: 0.018,
    recoveryRate: 0.040,
    trustBuildRate: 0.020,
    trustErosionRate: 0.010,
    notificationImpact: 0.02,
    autonomyDriftRate: 0.003,
  },

  inconsistent: {
    archetype: "inconsistent",
    description: "Highly variable engagement; trust and fatigue swing widely between sessions",
    baseState: {
      archetype: "inconsistent",
      fatigueLevel: 0.40,
      trustScore: 0.50,
      engagementScore: 0.50,
      recoveryCapacity: 0.50,
      notificationTolerance: 0.50,
      autonomyAcceptance: 0.50,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "normal",
    },
    fatigueRate: 0.035,
    recoveryRate: 0.025,
    trustBuildRate: 0.018,
    trustErosionRate: 0.022,
    notificationImpact: 0.05,
    autonomyDriftRate: 0.000,
  },

  anxious: {
    archetype: "anxious",
    description: "Very sensitive to unexpected changes; autonomy actions cause trust erosion unless clearly explained",
    baseState: {
      archetype: "anxious",
      fatigueLevel: 0.45,
      trustScore: 0.40,
      engagementScore: 0.55,
      recoveryCapacity: 0.35,
      notificationTolerance: 0.30,
      autonomyAcceptance: 0.28,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "reduced",
    },
    fatigueRate: 0.040,
    recoveryRate: 0.018,
    trustBuildRate: 0.010,
    trustErosionRate: 0.035,
    notificationImpact: 0.09,
    autonomyDriftRate: -0.004,
  },

  power_user: {
    archetype: "power_user",
    description: "Highly capable; dislikes over-pacing and excessive guardrails; builds trust quickly with results",
    baseState: {
      archetype: "power_user",
      fatigueLevel: 0.10,
      trustScore: 0.70,
      engagementScore: 0.85,
      recoveryCapacity: 0.80,
      notificationTolerance: 0.75,
      autonomyAcceptance: 0.85,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "adaptive",
    },
    fatigueRate: 0.010,
    recoveryRate: 0.060,
    trustBuildRate: 0.025,
    trustErosionRate: 0.020,
    notificationImpact: 0.015,
    autonomyDriftRate: 0.005,
  },

  low_trust: {
    archetype: "low_trust",
    description: "Sceptical of AI actions; starts with very low trust; trust erosion is fast, rebuilding is slow",
    baseState: {
      archetype: "low_trust",
      fatigueLevel: 0.35,
      trustScore: 0.20,
      engagementScore: 0.50,
      recoveryCapacity: 0.50,
      notificationTolerance: 0.45,
      autonomyAcceptance: 0.18,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "reduced",
    },
    fatigueRate: 0.030,
    recoveryRate: 0.025,
    trustBuildRate: 0.007,
    trustErosionRate: 0.040,
    notificationImpact: 0.06,
    autonomyDriftRate: -0.002,
  },

  high_autonomy: {
    archetype: "high_autonomy",
    description: "Actively wants the system to do more; frustrated by conservative guardrails",
    baseState: {
      archetype: "high_autonomy",
      fatigueLevel: 0.15,
      trustScore: 0.85,
      engagementScore: 0.80,
      recoveryCapacity: 0.75,
      notificationTolerance: 0.65,
      autonomyAcceptance: 0.92,
      interventionCount: 0,
      recoveryCount: 0,
      lastPacingMode: "adaptive",
    },
    fatigueRate: 0.012,
    recoveryRate: 0.050,
    trustBuildRate: 0.022,
    trustErosionRate: 0.008,
    notificationImpact: 0.01,
    autonomyDriftRate: 0.008,
  },
}

// ---------------------------------------------------------------------------
// Clamp helper
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

function computeEmotionalState(state: Pick<SyntheticUserState, "fatigueLevel" | "trustScore" | "recoveryCapacity">): SyntheticUserState["emotionalState"] {
  if (state.fatigueLevel > 0.85 || state.trustScore < 0.15) return "overloaded"
  if (state.fatigueLevel > 0.65) return "strained"
  if (state.recoveryCapacity < 0.30 && state.fatigueLevel > 0.50) return "recovering"
  return "calm"
}

/** Apply one "work tick" — user is actively working. */
export function tickWork(state: SyntheticUserState, profile: SyntheticUserProfile): { next: SyntheticUserState; event: SessionEvent } {
  const fatigueLevel = clamp01(state.fatigueLevel + profile.fatigueRate)
  const engagementScore = clamp01(state.engagementScore + 0.01)
  const trustScore = clamp01(state.trustScore + profile.trustBuildRate * 0.3)

  const next: SyntheticUserState = {
    ...state,
    tick: state.tick + 1,
    fatigueLevel,
    engagementScore,
    trustScore,
    emotionalState: computeEmotionalState({ fatigueLevel, trustScore, recoveryCapacity: state.recoveryCapacity }),
  }

  return {
    next,
    event: {
      tick: next.tick,
      type: "work_session_start",
      payload: { fatigueLevel: next.fatigueLevel, trustScore: next.trustScore },
    },
  }
}

/** Apply one "rest tick" — recovery period. */
export function tickRest(state: SyntheticUserState, profile: SyntheticUserProfile): { next: SyntheticUserState; event: SessionEvent } {
  const fatigueLevel = clamp01(state.fatigueLevel - profile.recoveryRate)
  const recoveryCapacity = clamp01(state.recoveryCapacity + 0.02)

  const next: SyntheticUserState = {
    ...state,
    tick: state.tick + 1,
    fatigueLevel,
    recoveryCapacity,
    recoveryCount: state.recoveryCount + 1,
    emotionalState: computeEmotionalState({ fatigueLevel, trustScore: state.trustScore, recoveryCapacity }),
  }

  return {
    next,
    event: { tick: next.tick, type: "recovery_event", payload: { fatigueLevel: next.fatigueLevel } },
  }
}

/** Simulate a notification being received. */
export function tickNotification(state: SyntheticUserState, profile: SyntheticUserProfile): { next: SyntheticUserState; event: SessionEvent } {
  const notificationTolerance = clamp01(state.notificationTolerance - profile.notificationImpact)
  const fatigueLevel = clamp01(state.fatigueLevel + profile.notificationImpact * 0.5)
  const trustScore = notificationTolerance < 0.2
    ? clamp01(state.trustScore - profile.trustErosionRate)
    : state.trustScore

  const next: SyntheticUserState = {
    ...state,
    tick: state.tick + 1,
    notificationTolerance,
    fatigueLevel,
    trustScore,
    emotionalState: computeEmotionalState({ fatigueLevel, trustScore, recoveryCapacity: state.recoveryCapacity }),
  }

  return {
    next,
    event: {
      tick: next.tick,
      type: "notification_received",
      payload: { notificationTolerance: next.notificationTolerance, trustImpact: trustScore - state.trustScore },
    },
  }
}

/** Simulate an autonomy action being applied. */
export function tickAutonomyAction(state: SyntheticUserState, profile: SyntheticUserProfile, explained: boolean): { next: SyntheticUserState; event: SessionEvent } {
  // Explained actions build trust slightly; unexplained ones erode it for anxious/low-trust archetypes.
  const trustDelta = explained
    ? profile.trustBuildRate
    : -profile.trustErosionRate * (state.autonomyAcceptance < 0.35 ? 1.5 : 1.0)

  const trustScore = clamp01(state.trustScore + trustDelta)
  const autonomyAcceptance = clamp01(state.autonomyAcceptance + profile.autonomyDriftRate)

  const next: SyntheticUserState = {
    ...state,
    tick: state.tick + 1,
    trustScore,
    autonomyAcceptance,
    emotionalState: computeEmotionalState({ fatigueLevel: state.fatigueLevel, trustScore, recoveryCapacity: state.recoveryCapacity }),
  }

  return {
    next,
    event: {
      tick: next.tick,
      type: "autonomy_action_applied",
      payload: { explained, trustDelta, trustScore: next.trustScore, autonomyAcceptance: next.autonomyAcceptance },
    },
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSyntheticUser(archetype: UserArchetype, userId?: string): SyntheticUserState {
  const profile = ARCHETYPES[archetype]
  return {
    ...profile.baseState,
    userId: userId ?? `synthetic-${archetype}-${Date.now()}`,
    tick: 0,
    emotionalState: computeEmotionalState({
      fatigueLevel: profile.baseState.fatigueLevel,
      trustScore: profile.baseState.trustScore,
      recoveryCapacity: profile.baseState.recoveryCapacity,
    }),
  }
}
