export type EquilibriumMode = "accelerated" | "balanced" | "stabilizing" | "recovery" | "locked"
export type WorkspaceDensity = "light" | "focused" | "expanded"

export type SessionSnapshot = {
  userId: string

  equilibriumState: {
    mode: EquilibriumMode
    fatigueRisk: number
    trustStability: number
    momentum: number
  }

  workspaceState: {
    density: WorkspaceDensity
    activeModules: string[]
    hiddenModules: string[]
  }

  continuityState: {
    activeTrajectory: string
    lastMeaningfulAction: string
    interruptedFlow?: string
    confidenceOfDirection: number
  }

  recoveryState: {
    activeRecoveryStrategy?: string
    recoveryProgress?: number
  }

  notificationState: {
    cadence: string
    suppressionLevel: string
  }

  // Global confidence used to choose conservative vs assertive re-entry.
  continuityConfidence: number

  timestamp: number
}

export type SessionSnapshotInput = {
  userId: string
  equilibriumState?: Partial<SessionSnapshot["equilibriumState"]>
  workspaceState?: Partial<SessionSnapshot["workspaceState"]>
  continuityState?: Partial<SessionSnapshot["continuityState"]>
  recoveryState?: Partial<SessionSnapshot["recoveryState"]>
  notificationState?: Partial<SessionSnapshot["notificationState"]>
  continuityConfidence?: number
  timestamp?: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5
  }
  return Math.max(0, Math.min(1, value))
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function createSessionSnapshot(input: SessionSnapshotInput): SessionSnapshot {
  const now = Number(input.timestamp ?? Date.now())

  return {
    userId: input.userId,
    equilibriumState: {
      mode: input.equilibriumState?.mode ?? "balanced",
      fatigueRisk: clamp01(Number(input.equilibriumState?.fatigueRisk ?? 0.4)),
      trustStability: clamp01(Number(input.equilibriumState?.trustStability ?? 0.6)),
      momentum: clamp01(Number(input.equilibriumState?.momentum ?? 0.55)),
    },
    workspaceState: {
      density: input.workspaceState?.density ?? "focused",
      activeModules: normalizeArray(input.workspaceState?.activeModules ?? ["dashboard"]),
      hiddenModules: normalizeArray(input.workspaceState?.hiddenModules ?? []),
    },
    continuityState: {
      activeTrajectory: String(input.continuityState?.activeTrajectory ?? "general_progress"),
      lastMeaningfulAction: String(input.continuityState?.lastMeaningfulAction ?? "resume_previous_flow"),
      interruptedFlow:
        typeof input.continuityState?.interruptedFlow === "string"
          ? input.continuityState.interruptedFlow
          : undefined,
      confidenceOfDirection: clamp01(Number(input.continuityState?.confidenceOfDirection ?? 0.6)),
    },
    recoveryState: {
      activeRecoveryStrategy:
        typeof input.recoveryState?.activeRecoveryStrategy === "string"
          ? input.recoveryState.activeRecoveryStrategy
          : undefined,
      recoveryProgress:
        typeof input.recoveryState?.recoveryProgress === "number"
          ? clamp01(input.recoveryState.recoveryProgress)
          : undefined,
    },
    notificationState: {
      cadence: String(input.notificationState?.cadence ?? "steady"),
      suppressionLevel: String(input.notificationState?.suppressionLevel ?? "moderate"),
    },
    continuityConfidence: clamp01(Number(input.continuityConfidence ?? 0.6)),
    timestamp: Number.isFinite(now) ? now : Date.now(),
  }
}
