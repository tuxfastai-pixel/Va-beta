import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

function isMissingCareerColumns(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return (
    message.includes("careers") ||
    message.includes("primary_career") ||
    message.includes("secondary_careers")
  )
}

  function isMissingCareerActivationTable(error: { message?: string } | null | undefined) {
    const message = String(error?.message || "").toLowerCase()
    return message.includes("career_activation_states") && message.includes("could not find the table")
  }

export async function GET(req: NextRequest) {
  const session = await getSessionUser()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = String(req.nextUrl.searchParams.get("userId") || "").trim()

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  if (userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await supabaseServer
    .from("profiles")
    .select("careers, primary_career, secondary_careers")
    .eq("id", userId)
    .maybeSingle()

  if (error && !isMissingCareerColumns(error)) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (error && isMissingCareerColumns(error)) {
    const { data: stateData, error: stateError } = await supabaseServer
      .from("career_activation_states")
      .select("career_lanes")
      .eq("user_id", userId)
      .maybeSingle()

    if (stateError) {
        if (isMissingCareerActivationTable(stateError)) {
          return NextResponse.json({})
        }

        return NextResponse.json({ error: stateError.message }, { status: 500 })
    }

    const lanes = (stateData?.career_lanes || {}) as {
      selected?: string[]
      primary?: string
      secondary?: string[]
    }

    return NextResponse.json({
      careers: Array.isArray(lanes.selected) ? lanes.selected : [],
      primary_career: String(lanes.primary || ""),
      secondary_careers: Array.isArray(lanes.secondary) ? lanes.secondary : [],
    })
  }

  return NextResponse.json(data || {})
}