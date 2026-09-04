import { NextRequest, NextResponse } from "next/server"
import { buildAutonomyAuditSnapshot } from "@/lib/autonomy/autonomyAuditSnapshot"
import { requireAdminRole } from "@/lib/auth/serverAuth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const userId = request.nextUrl.searchParams.get("userId")
    const tier = request.nextUrl.searchParams.get("tier")
    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Number(limitParam) : 40

    const snapshot = await buildAutonomyAuditSnapshot({
      userId: userId?.trim() || null,
      tier: tier?.trim() || null,
      limit: Number.isFinite(limit) ? limit : 40,
    })

    return NextResponse.json({
      snapshot,
      status: "ok",
    })
  } catch (error) {
    console.error("autonomy-audit error:", error)
    return NextResponse.json({ error: "Failed to build autonomy audit snapshot" }, { status: 500 })
  }
}