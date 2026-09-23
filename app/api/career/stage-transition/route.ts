import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { transitionToStage, getFullJourneyState } from "@/lib/career/careerJourneyService"
import { getStageIndex, isValidStage, validateStageTransition } from "@/lib/career/activationContinuity.ts"

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { toStage, stageData } = body

    // Validate target stage
    if (!isValidStage(toStage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
    }

    // Get current journey state
    const currentState = await getFullJourneyState(session.userId)
    if (!currentState) {
      return NextResponse.json({ error: "No active career activation" }, { status: 400 })
    }

    const currentStage = currentState.currentStage || "complete"

    const completedStages = Array.isArray(
      currentState.completedStages
    )
      ? currentState.completedStages.filter(isValidStage)
      : []

    const isCompletedRevisit =
      getStageIndex(toStage) <
        getStageIndex(currentStage) &&
      completedStages.includes(toStage)

    // Revisiting a completed page is navigation only. Preserve the
    // user's furthest saved stage and do not rewrite journey progress.
    if (isCompletedRevisit) {
      return NextResponse.json({
        success: true,
        stage: toStage,
        currentStage,
        revisit: true,
      })
    }

    // New progression must still follow the guarded stage order.
    const isValid = validateStageTransition(
      currentStage,
      toStage
    )

    if (!isValid) {
      return NextResponse.json(
        {
          error:
            `Cannot transition from ${currentStage} ` +
            `to ${toStage}`,
        },
        { status: 400 }
      )
    }

    // Execute transition
    const result = await transitionToStage({
      userId: session.userId,
      fromStage: currentStage,
      toStage,
      stageData,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Transition failed" }, { status: 400 })
    }

    return NextResponse.json({ success: true, stage: toStage })
  } catch (error) {
    console.error("stage-transition error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
