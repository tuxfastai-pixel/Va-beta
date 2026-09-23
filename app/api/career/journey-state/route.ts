import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { getFullJourneyState } from "@/lib/career/careerJourneyService.ts"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const state = await getFullJourneyState(session.userId)
  return NextResponse.json({ state: state || null })
}
