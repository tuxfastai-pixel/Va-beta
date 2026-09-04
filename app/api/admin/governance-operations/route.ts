import { NextRequest, NextResponse } from "next/server"
import { buildGovernanceOperationsSnapshot, exportGovernanceAuditBundle } from "@/lib/governance/governanceOperations"
import { requireAdminRole } from "@/lib/auth/serverAuth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const exportMode = request.nextUrl.searchParams.get("export") === "1"
    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Number(limitParam) : 80

    if (exportMode) {
      const bundle = await exportGovernanceAuditBundle(Number.isFinite(limit) ? limit : 200)
      return NextResponse.json({ status: "ok", bundle })
    }

    const snapshot = await buildGovernanceOperationsSnapshot(Number.isFinite(limit) ? limit : 80)
    return NextResponse.json({ status: "ok", snapshot })
  } catch (error) {
    console.error("governance-operations GET error:", error)
    return NextResponse.json({ error: "Failed to load governance operations snapshot" }, { status: 500 })
  }
}
