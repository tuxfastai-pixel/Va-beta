import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { transitionToStage, getFullJourneyState } from "@/lib/career/careerJourneyService"
import { isValidStage, validateStageTransition } from "@/lib/career/activationContinuity.ts"

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

    // Validate transition
    const isValid = validateStageTransition(currentStage, toStage)
    if (!isValid) {
      return NextResponse.json(
        { error: `Cannot transition from ${currentStage} to ${toStage}` },
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
