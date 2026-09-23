import { NextRequest, NextResponse } from "next/server"
import {
  getPersonalizationState,
  listPersonalizationStates,
} from "@/lib/personalization/personalizationStore"
import { listIdentityDriftAlerts } from "@/lib/personalization/identityDriftAlerts"
import { listEquilibriumEvents } from "@/lib/telemetry/equilibriumEventStream"
import {
  listGovernanceInterventions,
} from "@/lib/governance/governanceInterventionLog"
import { analyzeDriftEscalation } from "@/lib/governance/driftEscalation"
import {
  applyGovernanceAction,
  type GovernanceAction,
} from "@/lib/governance/governanceActionEngine"
import { buildInterventionTimeline } from "@/lib/governance/interventionTimeline"
import { requireAdminRole, requireFounderRole } from "@/lib/auth/serverAuth"

type DriftSeverity = "low" | "moderate" | "high" | "critical"

type AnyState = NonNullable<Awaited<ReturnType<typeof getPersonalizationState>>>

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeRecoveryFrequencyPerDay(timestamps: number[]): number {
  if (timestamps.length === 0) {
    return 0
  }

  const sorted = timestamps.slice().sort((a, b) => a - b)
  const timespanDays = Math.max(1 / 24, (sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60 * 24))
  return sorted.length / timespanDays
}

function computeAdaptiveConfidence(state: AnyState) {
  const rhythmInstability = average(
    state.rhythm.hourlyProfile.map((row) => clamp01((row.fatigueScore + row.disengagementScore) * 0.5)),
  )
  const recoveryAffinity = average([
    state.recovery.reducedNotificationAffinity,
    state.recovery.reassuranceAffinity,
    state.recovery.simplificationAffinity,
    state.recovery.pacingSlowdownAffinity,
  ])
  const recoveryDurationComponent = clamp01(1 - state.recovery.expectedRecoveryDurationMs / (6 * 60 * 60 * 1000))
  const eventMaturity = clamp01(state.eventHistory.length / 120)

  const learningConfidence = clamp01(
    state.identity.adaptationConfidence * 0.45 + eventMaturity * 0.35 + state.trust.regulationAcceptance * 0.2,
  )

  const rhythmStability = clamp01(
    (1 - rhythmInstability) * 0.62 + average(state.rhythm.hourlyProfile.map((row) => row.recoveryScore)) * 0.38,
  )

  const recoveryReliability = clamp01(
    state.recovery.confidence * 0.5 + recoveryAffinity * 0.3 + recoveryDurationComponent * 0.2,
  )

  const trustContinuity = clamp01(
    state.trust.trustStability * 0.35 +
      state.trust.continuityConfidence * 0.4 +
      state.trust.regulationAcceptance * 0.25,
  )

  const identityCoherence = clamp01(
    state.identity.adaptationConfidence * 0.3 +
      state.trust.continuityConfidence * 0.5 +
      (1 - Math.min(1, Math.abs(state.trust.trustMomentum))) * 0.2,
  )

  return {
    learningConfidence,
    rhythmStability,
    recoveryReliability,
    trustContinuity,
    identityCoherence,
  }
}

function deriveDriftVisuals(params: {
  alerts: Array<{ timestamp: number; delta: number }>
  trustMomentum: number
  recoveryEventTimestamps: number[]
}) {
  const sortedAlerts = params.alerts.slice().sort((a, b) => a.timestamp - b.timestamp)
  const trendSparkline = sortedAlerts.slice(-20).map((entry) => clamp01(entry.delta))
  const driftVelocity =
    sortedAlerts.length >= 2
      ? (sortedAlerts[sortedAlerts.length - 1].delta - sortedAlerts[0].delta) /
        Math.max(1, (sortedAlerts[sortedAlerts.length - 1].timestamp - sortedAlerts[0].timestamp) / (1000 * 60 * 60))
      : 0

  const trustDecayIndicator = clamp01(Math.max(0, -params.trustMomentum))
  const recoveryFrequencyPerDay = computeRecoveryFrequencyPerDay(params.recoveryEventTimestamps)

  const recoveryFrequencyOverlay = sortedAlerts.slice(-20).map((alert) => {
    const nearbyRecoveryEvents = params.recoveryEventTimestamps.filter(
      (eventTs) => Math.abs(eventTs - alert.timestamp) <= 6 * 60 * 60 * 1000,
    ).length
    return clamp01(nearbyRecoveryEvents / 3)
  })

  return {
    trendSparkline,
    driftVelocity,
    trustDecayIndicator,
    recoveryFrequencyPerDay,
    recoveryFrequencyOverlay,
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const userId = req.nextUrl.searchParams.get("userId")
    const alertsLimitParam = req.nextUrl.searchParams.get("alertsLimit")
    const alertsLimit = alertsLimitParam ? Number(alertsLimitParam) : 50
    const timelineLimitParam = req.nextUrl.searchParams.get("timelineLimit")
    const timelineLimit = timelineLimitParam ? Number(timelineLimitParam) : 200

    const interventions = await listGovernanceInterventions(500)
    const eqEvents = await listEquilibriumEvents({ limit: 5_000 })

    if (userId) {
      const state = await getPersonalizationState(userId)
      if (!state) {
        return NextResponse.json({ error: "No personalization profile found" }, { status: 404 })
      }

      const driftAlerts = await listIdentityDriftAlerts({ userId, limit: alertsLimit })
      const highDriftCount = driftAlerts.filter((alert) => alert.delta >= 0.6).length
      const recoveryEvents = state.eventHistory.filter((event) => event.recoveryTriggered).map((event) => event.timestamp)

      const driftVisuals = deriveDriftVisuals({
        alerts: driftAlerts,
        trustMomentum: state.trust.trustMomentum,
        recoveryEventTimestamps: recoveryEvents,
      })
      const confidence = computeAdaptiveConfidence(state)
      const avgAdaptationIntensity =
        state.eventHistory.length > 0
          ? average(
              state.eventHistory.map((event) =>
                clamp01((event.fatigueRisk + event.pressureLevel + state.identity.adaptationConfidence) / 3),
              ),
            )
          : state.identity.adaptationConfidence

      const escalation = analyzeDriftEscalation({
        recentAlerts: driftAlerts,
        identity: state.identity,
        trust: state.trust,
        recoveryFrequencyPerDay: driftVisuals.recoveryFrequencyPerDay,
        continuityEvents: state.eventHistory.length,
        averageAdaptationIntensity: avgAdaptationIntensity,
      })

      const timeline = buildInterventionTimeline({
        interventions,
        equilibriumEvents: eqEvents,
        driftAlerts,
        userId,
        limit: timelineLimit,
      })

      const suggestions: string[] = []
      if (confidence.rhythmStability < 0.45) {
        suggestions.push("Recovery cycles are becoming frequent.")
      }
      if (driftVisuals.driftVelocity > 0.01) {
        suggestions.push("Identity drift rising after recent adaptation changes.")
      }
      if (state.identity.pacingStyle === "deliberate" && state.trust.regulationAcceptance > 0.75) {
        suggestions.push("User appears overstabilized.")
      }
      if (state.identity.workspaceTolerance === "compact" && driftVisuals.recoveryFrequencyPerDay > 1.2) {
        suggestions.push("Workspace contraction frequency suggests overload.")
      }

      return NextResponse.json({
        userId,
        profile: state.profile,
        rhythm: state.rhythm,
        recovery: state.recovery,
        trust: state.trust,
        identity: state.identity,
        updatedAt: state.updatedAt,
        eventSampleSize: state.eventHistory.length,
        driftAlerts,
        driftSeverity: highDriftCount > 3 ? "critical" : highDriftCount > 1 ? "high" : driftAlerts.length > 0 ? "moderate" : "low",
        driftVisuals,
        confidence,
        escalation,
        governanceSuggestions: suggestions,
        interventionTimeline: timeline,
      })
    }

    const limitParam = req.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Number(limitParam) : 100
    const states = await listPersonalizationStates(limit)
    const driftAlerts = await listIdentityDriftAlerts({ limit: alertsLimit })

    const alertsByUser = new Map<string, typeof driftAlerts>()
    for (const alert of driftAlerts) {
      const current = alertsByUser.get(alert.userId) ?? []
      current.push(alert)
      alertsByUser.set(alert.userId, current)
    }

    const eventByUser = new Map<string, number[]>()
    for (const event of eqEvents) {
      if (!event.recoveryTriggered) {
        continue
      }
      const current = eventByUser.get(event.userId) ?? []
      current.push(event.timestamp)
      eventByUser.set(event.userId, current)
    }

    const profiles = states.map((state) => {
      const userAlerts = alertsByUser.get(state.userId) ?? []
      const highDriftCount = userAlerts.filter((alert) => alert.delta >= 0.6).length
      const driftSeverity: DriftSeverity =
        highDriftCount >= 3 ? "critical" : highDriftCount >= 2 ? "high" : userAlerts.length > 0 ? "moderate" : "low"
      const confidence = computeAdaptiveConfidence(state)
      const driftVisuals = deriveDriftVisuals({
        alerts: userAlerts,
        trustMomentum: state.trust.trustMomentum,
        recoveryEventTimestamps: eventByUser.get(state.userId) ?? [],
      })

      const escalation = analyzeDriftEscalation({
        recentAlerts: userAlerts,
        identity: state.identity,
        trust: state.trust,
        recoveryFrequencyPerDay: driftVisuals.recoveryFrequencyPerDay,
        continuityEvents: state.eventHistory.length,
        averageAdaptationIntensity:
          state.eventHistory.length > 0
            ? average(
                state.eventHistory.map((event) =>
                  clamp01((event.fatigueRisk + event.pressureLevel + state.identity.adaptationConfidence) / 3),
                ),
              )
            : state.identity.adaptationConfidence,
      })

      return {
        userId: state.userId,
        identity: state.identity,
        trust: state.trust,
        updatedAt: state.updatedAt,
        eventSampleSize: state.eventHistory.length,
        driftSeverity,
        driftVisuals,
        confidence,
        escalation,
      }
    })

    const suggestions: string[] = []
    const avgRecoveryFrequency = average(profiles.map((profile) => profile.driftVisuals.recoveryFrequencyPerDay))
    const avgVelocity = average(profiles.map((profile) => profile.driftVisuals.driftVelocity))
    const compactToleranceShare =
      profiles.length > 0
        ? profiles.filter((profile) => profile.identity.workspaceTolerance === "compact").length / profiles.length
        : 0
    const lowRhythmShare =
      profiles.length > 0
        ? profiles.filter((profile) => profile.confidence.rhythmStability < 0.45).length / profiles.length
        : 0

    if (lowRhythmShare > 0.35 || avgRecoveryFrequency > 1.25) {
      suggestions.push("Recovery cycles are becoming frequent.")
    }
    if (avgVelocity > 0.01) {
      suggestions.push("Identity drift rising after recent adaptation changes.")
    }
    if (compactToleranceShare > 0.45) {
      suggestions.push("Workspace contraction frequency suggests overload.")
    }
    if (
      profiles.length > 0 &&
      profiles.filter((profile) => profile.identity.pacingStyle === "deliberate" && profile.trust.regulationAcceptance > 0.75).length /
        profiles.length >
        0.35
    ) {
      suggestions.push("User appears overstabilized.")
    }

    const timeline = buildInterventionTimeline({
      interventions,
      equilibriumEvents: eqEvents,
      driftAlerts,
      limit: timelineLimit,
    })

    return NextResponse.json({
      profiles,
      driftAlerts,
      count: profiles.length,
      governanceSuggestions: suggestions,
      interventionTimeline: timeline,
      driftSeverityLegend: {
        low: "expected evolution",
        moderate: "accelerated adaptation",
        high: "unstable identity change",
        critical: "continuity integrity risk",
      },
      availableGovernanceActions: [
        { key: "freeze_personalization", label: "Freeze personalization", purpose: "stop learning" },
        { key: "force_balanced_mode", label: "Force balanced mode", purpose: "stabilize pacing" },
        { key: "trigger_recovery_mode", label: "Trigger recovery mode", purpose: "calm system" },
        { key: "emergency_safe_mode", label: "Emergency safe mode", purpose: "activate emergency guardrails" },
        { key: "reduce_adaptation_intensity", label: "Reduce adaptation intensity", purpose: "lower mutation power" },
        { key: "disable_pacing", label: "Disable pacing", purpose: "disable autonomous pacing" },
        { key: "reset_rhythm_learning", label: "Reset rhythm learning", purpose: "clear unstable rhythms" },
        { key: "revert_equilibrium_profile", label: "Revert equilibrium profile", purpose: "rollback identity" },
        { key: "rollback_workspace", label: "Rollback workspace", purpose: "restore stable workspace" },
        { key: "suppress_proactive_adaptation", label: "Suppress proactive adaptation", purpose: "reduce orchestration" },
        { key: "disable_orchestration", label: "Disable orchestration", purpose: "stop orchestration loops" },
        { key: "lock_workspace_mode", label: "Lock workspace mode", purpose: "stop UI morphing" },
        { key: "force_quiet_notifications", label: "Force quiet notifications", purpose: "reduce notification pressure" },
      ],
    })
  } catch (error) {
    console.error("admin personalization GET error:", error)
    return NextResponse.json({ error: "Failed to load personalization profiles" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const body = (await req.json()) as {
      action?: GovernanceAction
      actor?: string
      userId?: string
      rationale?: string
      source?: string
    }

    const action = body.action
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "emergency_safe_mode") {
      const founderAuth = await requireFounderRole()
      if ("response" in founderAuth) return founderAuth.response
    }

    const actor = body.actor ?? "personalization-admin"
    const userId = body.userId?.trim() || null
    const source = body.source ?? "admin-console"
    const rationale = body.rationale ?? `Governance action from personalization console: ${action}`

    const result = await applyGovernanceAction({
      actor,
      action,
      rationale,
      source,
      userId,
    })

    return NextResponse.json({
      ok: true,
      intervention: result.intervention,
      telemetryEvent: result.telemetryEvent,
      config: result.config,
      personalizationRolloutPolicy: result.personalizationRolloutPolicy,
      stateMutation: result.stateMutation,
      uiState: result.uiState,
      calmMessage: result.calmMessage,
    })
  } catch (error) {
    console.error("admin personalization POST error:", error)
    return NextResponse.json({ error: "Failed to apply governance action" }, { status: 500 })
  }
}
