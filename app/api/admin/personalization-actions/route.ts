import { NextRequest, NextResponse } from "next/server"
import { loadPersonalizationStates, savePersonalizationStates } from "@/lib/personalization/personalizationStore"
import { logGovernanceIntervention } from "@/lib/governance/governanceInterventionLog"
import { requireAdminRole } from "@/lib/auth/serverAuth"

export type PersonalizationActionRequest = {
  action:
    | "freeze_personalization"
    | "force_balanced_mode"
    | "trigger_recovery_mode"
    | "reduce_adaptation_intensity"
    | "reset_rhythm_learning"
    | "revert_equilibrium_profile"
    | "suppress_proactive_adaptation"
    | "lock_workspace_mode"
  userId: string
  reason?: string
}

export type PersonalizationActionResponse = {
  success: boolean
  action: string
  userId: string
  timestamp: number
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const body = (await request.json()) as PersonalizationActionRequest
    const { action, userId, reason } = body

    const states = await loadPersonalizationStates()
    const state = states[userId]

    if (!state) {
      return NextResponse.json(
        { success: false, message: `No personalization state for user ${userId}` },
        { status: 404 },
      )
    }

    const timestamp = Date.now()
    const actionSummary = `${action} triggered by admin`

    const setModerateCadence = () => {
      state.profile.preferredCadenceBand = "moderate"
      state.profile.preferredActionsPerHour = Math.max(3, Math.min(6, state.profile.preferredActionsPerHour))
    }

    switch (action) {
      case "freeze_personalization":
        setModerateCadence()
        state.trust.adaptationComfort = Math.max(0, state.trust.adaptationComfort - 0.1)
        state.trust.computedAt = timestamp
        break

      case "force_balanced_mode":
        setModerateCadence()
        state.profile.workspaceDensityPreference = 0.55
        state.profile.interruptionSensitivity = 0.5
        break

      case "trigger_recovery_mode":
        state.recovery.reducedNotificationAffinity = Math.max(0.65, state.recovery.reducedNotificationAffinity)
        state.recovery.simplificationAffinity = Math.max(0.65, state.recovery.simplificationAffinity)
        state.recovery.pacingSlowdownAffinity = Math.max(0.7, state.recovery.pacingSlowdownAffinity)
        state.recovery.learnedAt = timestamp
        break

      case "reduce_adaptation_intensity":
        state.profile.preferredActionsPerHour = Math.max(2, state.profile.preferredActionsPerHour - 1)
        setModerateCadence()
        break

      case "reset_rhythm_learning":
        state.rhythm.hourlyProfile = []
        state.rhythm.accelerationWindows = []
        state.rhythm.fatigueWindows = []
        state.rhythm.disengagementWindows = []
        state.rhythm.bestRecoveryWindows = []
        state.rhythm.learnedAt = timestamp
        break

      case "revert_equilibrium_profile":
        state.profile = {
          preferredCadenceBand: "moderate",
          preferredActionsPerHour: 5,
          toleranceThresholds: {
            pressure: 0.6,
            fatigue: 0.55,
            interruptionsPerHour: 3,
          },
          recoverySpeed: {
            medianRecoveryMs: 2 * 60 * 60 * 1000,
            confidence: 0.2,
          },
          workspaceDensityPreference: 0.55,
          interruptionSensitivity: 0.5,
          computedAt: timestamp,
        }
        break

      case "suppress_proactive_adaptation":
        state.trust.regulationAcceptance = Math.max(0.4, state.trust.regulationAcceptance)
        state.trust.adaptationComfort = Math.max(0.35, state.trust.adaptationComfort - 0.15)
        state.trust.computedAt = timestamp
        break

      case "lock_workspace_mode":
        state.profile.workspaceDensityPreference = 0.5
        state.profile.interruptionSensitivity = Math.max(state.profile.interruptionSensitivity, 0.55)
        state.profile.computedAt = timestamp
        break
    }

    state.updatedAt = timestamp

    await savePersonalizationStates(states)

    await logGovernanceIntervention({
      actor: "admin-governance",
      action,
      rationale: reason || actionSummary,
      metadata: {
        userId,
      },
    })

    return NextResponse.json({
      success: true,
      action,
      userId,
      timestamp,
      message: `${action} applied to ${userId}`,
    } as PersonalizationActionResponse)
  } catch (error) {
    console.error("Error applying personalization action:", error)
    return NextResponse.json(
      { success: false, message: "Failed to apply action" },
      { status: 500 },
    )
  }
}
