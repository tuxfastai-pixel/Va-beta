import { NextRequest, NextResponse } from "next/server"
import { buildTrustMonitoringSnapshot } from "@/lib/trust/trustMonitoringSnapshot"
import { requireAdminRole } from "@/lib/auth/serverAuth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Number(limitParam) : 120
    const snapshot = await buildTrustMonitoringSnapshot(limit)

    return NextResponse.json({
      snapshot,
      status: "ok",
    })
  } catch (error) {
    console.error("trust-monitoring error:", error)
    return NextResponse.json(
      { error: "Failed to build trust monitoring snapshot" },
      { status: 500 },
    )
  }
}
