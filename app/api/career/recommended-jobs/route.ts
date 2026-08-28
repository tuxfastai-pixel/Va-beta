import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch recommended jobs (placeholder: return empty for Phase 1)
    // In Phase 3, this will query job recommendations based on profile

    return NextResponse.json({
      jobs: [],
    })
  } catch (error) {
    console.error("recommended-jobs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
