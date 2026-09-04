import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { markCareerActivationComplete } from "@/lib/career/careerJourneyService"

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Mark career activation as complete
    await markCareerActivationComplete(session.userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("mark-complete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
