import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch interview prep data (based on job assessment and profile)
    // Placeholder: return basic structure

    return NextResponse.json({
      companyOverview: "Research the company's mission, culture, recent news, and growth.",
      keyQuestions: [
        "Tell me about yourself and your career journey.",
        "Why are you interested in this role?",
        "What is your experience with the key skills listed?",
        "Describe a challenge you overcame in a similar role.",
        "What are your career goals?",
      ],
      learningSprintStarted: false,
    })
  } catch (error) {
    console.error("interview-prep error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === "start-sprint") {
      // Mark learning sprint as started in DB (if table exists)
      // For now, just return success
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("interview-prep POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
