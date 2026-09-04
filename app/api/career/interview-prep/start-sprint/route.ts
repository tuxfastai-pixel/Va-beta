import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Start learning sprint by delegating to interview-prep endpoint
    const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/career/interview-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start-sprint" }),
    })

    return await res.json()
  } catch (error) {
    console.error("start-sprint error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
