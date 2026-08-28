import type { EquilibriumEvent } from "../telemetry/equilibriumEventStream.ts"
import type { TrustWindow } from "../trust/trustHistoryStore.ts"
import type { GovernanceIntervention } from "../governance/governanceInterventionLog.ts"
import { explainGovernanceDecision } from "../governance/explainabilityEngine.ts"

type ReplayInput = {
  userId: string
  events: EquilibriumEvent[]
  trustWindows?: TrustWindow[]
  interventions?: GovernanceIntervention[]
}

export type HumanReplayEntry = {
  timestamp: number
  equilibriumState: string
  workspaceDensity: "light" | "focused" | "expanded"
  notificationCadence: "quiet" | "steady" | "fast"
  pacingMode: "reduced" | "normal" | "adaptive"
  trustScore: number
  recoveryActivated: boolean
  continuityConfidence: number
  emotionalState: "calm" | "strained" | "recovering" | "overloaded"
  explainability: ReturnType<typeof explainGovernanceDecision>
}

export type HumanSessionReplayReport = {
  userId: string
  timeline: HumanReplayEntry[]
  behavioralTimeline: string[]
  governanceDecisionTrail: string[]
  counterfactualAnalysis: string[]
  validation: {
    pacingStayedCalm: boolean
    notificationsDownshifted: boolean
    trustNotDegraded: boolean
    workspaceAdapted: boolean
    recoveryActivatedOnOverload: boolean
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function toDensity(metadata?: Record<string, unknown>): "light" | "focused" | "expanded" {
  const raw = String(metadata?.workspaceDensity ?? metadata?.workspaceMode ?? "focused").toLowerCase()
  if (raw.includes("light") || raw.includes("compact") || raw.includes("simpl")) {
    return "light"
  }
  if (raw.includes("expand")) {
    return "expanded"
  }
  return "focused"
}

function toCadence(metadata?: Record<string, unknown>, pressure = 0.5): "quiet" | "steady" | "fast" {
  const raw = String(metadata?.notificationCadence ?? metadata?.notificationMode ?? "").toLowerCase()
  if (raw.includes("quiet") || raw.includes("suppress")) {
    return "quiet"
  }
  if (raw.includes("fast") || pressure > 0.72) {
    return "fast"
  }
  return "steady"
}

function emotionFromEvent(event: EquilibriumEvent): HumanReplayEntry["emotionalState"] {
  if (event.recoveryTriggered || event.nextState === "recovery") {
    return "recovering"
  }
  if (event.fatigueRisk > 0.78 || event.pressureLevel > 0.82) {
    return "overloaded"
  }
  if (event.fatigueRisk > 0.58 || event.pressureLevel > 0.62) {
    return "strained"
  }
  return "calm"
}

function findTrustScore(timestamp: number, windows: TrustWindow[]): number {
  if (windows.length === 0) {
    return 0.6
  }

  const sorted = windows.slice().sort((a, b) => a.timestamp - b.timestamp)
  const candidate = sorted.findLast((window) => window.timestamp <= timestamp) ?? sorted[0]
  return clamp01(candidate.metrics.compositeTrustScore)
}

function findContinuityConfidence(timestamp: number, windows: TrustWindow[]): number {
  if (windows.length === 0) {
    return 0.6
  }

  const sorted = windows.slice().sort((a, b) => a.timestamp - b.timestamp)
  const candidate = sorted.findLast((window) => window.timestamp <= timestamp) ?? sorted[0]
  return clamp01(candidate.metrics.continuityTrustScore)
}

export function replayHumanSession(input: ReplayInput): HumanSessionReplayReport {
  const sortedEvents = input.events.slice().sort((a, b) => a.timestamp - b.timestamp)
  const trustWindows = input.trustWindows ?? []
  const interventions = (input.interventions ?? [])
    .filter((item) => item.metadata?.userId === input.userId || !item.metadata?.userId)
    .sort((a, b) => a.timestamp - b.timestamp)

  const timeline: HumanReplayEntry[] = sortedEvents.map((event) => {
    const workspaceDensity = toDensity(event.metadata)
    const notificationCadence = toCadence(event.metadata, event.pressureLevel)
    const pacingMode: HumanReplayEntry["pacingMode"] =
      event.nextState === "recovery" || event.nextState === "stabilizing"
        ? "reduced"
        : event.pressureLevel > 0.68
          ? "adaptive"
          : "normal"

    const explainability = explainGovernanceDecision({
      decision: event.eventType,
      category:
        event.recoveryTriggered || event.nextState === "recovery"
          ? "recovery"
          : notificationCadence === "quiet"
            ? "notifications"
            : workspaceDensity === "light"
              ? "workspace"
              : "pacing",
      factors: [
        { key: "pressureLevel", value: event.pressureLevel, threshold: 0.68, direction: "above", label: "Interaction pressure" },
        { key: "fatigueRisk", value: event.fatigueRisk, threshold: 0.65, direction: "above", label: "Fatigue risk" },
        { key: "recoveryTriggered", value: event.recoveryTriggered, threshold: 1, direction: "above", label: "Recovery trigger" },
      ],
      context: `state ${event.previousState} -> ${event.nextState}`,
    })

    return {
      timestamp: event.timestamp,
      equilibriumState: event.nextState,
      workspaceDensity,
      notificationCadence,
      pacingMode,
      trustScore: findTrustScore(event.timestamp, trustWindows),
      recoveryActivated: event.recoveryTriggered || event.nextState === "recovery",
      continuityConfidence: findContinuityConfidence(event.timestamp, trustWindows),
      emotionalState: emotionFromEvent(event),
      explainability,
    }
  })

  const governanceDecisionTrail = [
    ...timeline.map((entry) => `${new Date(entry.timestamp).toISOString()} -> ${entry.explainability.summary}`),
    ...interventions.map((intervention) => `${new Date(intervention.timestamp).toISOString()} -> intervention ${intervention.action}: ${intervention.rationale}`),
  ]

  const behavioralTimeline = timeline.map((entry) => {
    const minuteLabel = new Date(entry.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    return `${minuteLabel} -> ${entry.equilibriumState}; fatigue=${entry.emotionalState}; notifications=${entry.notificationCadence}; workspace=${entry.workspaceDensity}; trust=${entry.trustScore.toFixed(2)}`
  })

  const overloadEvents = sortedEvents.filter((event) => event.fatigueRisk >= 0.78 || event.pressureLevel >= 0.82)
  const recoveryEvents = sortedEvents.filter((event) => event.recoveryTriggered || event.nextState === "recovery")
  const counterfactualAnalysis: string[] = []

  if (overloadEvents.length > 0) {
    if (recoveryEvents.length > 0) {
      counterfactualAnalysis.push(
        "If recovery had not activated at high-pressure moments, projected fatigue risk would likely have exceeded 0.82.",
      )
    } else {
      counterfactualAnalysis.push(
        "Recovery did not activate despite overload indicators; projected disengagement risk likely increased.",
      )
    }
  }

  const trustStart = timeline[0]?.trustScore ?? 0.6
  const trustEnd = timeline[timeline.length - 1]?.trustScore ?? trustStart
  const calmPacingShare =
    timeline.length > 0
      ? timeline.filter((entry) => entry.pacingMode !== "adaptive" || entry.emotionalState !== "overloaded").length / timeline.length
      : 1

  return {
    userId: input.userId,
    timeline,
    behavioralTimeline,
    governanceDecisionTrail,
    counterfactualAnalysis,
    validation: {
      pacingStayedCalm: calmPacingShare >= 0.65,
      notificationsDownshifted:
        overloadEvents.length === 0 ||
        timeline.some((entry) => entry.notificationCadence === "quiet" && (entry.emotionalState === "strained" || entry.emotionalState === "overloaded")),
      trustNotDegraded: trustEnd >= trustStart - 0.08,
      workspaceAdapted:
        overloadEvents.length === 0 || timeline.some((entry) => entry.workspaceDensity === "light"),
      recoveryActivatedOnOverload: overloadEvents.length === 0 || recoveryEvents.length > 0,
    },
  }
}
