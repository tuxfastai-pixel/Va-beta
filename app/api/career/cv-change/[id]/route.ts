import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const action = request.nextUrl.pathname.includes("/approve") ? "approved" : "rejected"

    // Delegate to parent route
    return await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/career/cv-changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeId: id, action }),
    }).then((res) => res.json())
  } catch (error) {
    console.error("cv-change approve/reject error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
