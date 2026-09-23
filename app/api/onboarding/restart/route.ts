import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { requireRestartConfirmation } from "@/lib/career/activationContinuity"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { confirm?: boolean; reason?: string }

  let confirmation
  try {
    confirmation = requireRestartConfirmation({ confirm: Boolean(body.confirm), reason: body.reason })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Restart confirmation required" }, { status: 400 })
  }

  const { data: current, error: currentError } = await supabaseServer
    .from("career_activation_states")
    .select("restart_count")
    .eq("user_id", session.userId)
    .maybeSingle()

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 })
  }

  const restartCount = Number(current?.restart_count || 0) + 1

  const { error } = await supabaseServer
    .from("career_activation_states")
    .upsert(
      {
        user_id: session.userId,
        onboarding_completed: false,
        completed_step: 0,
        last_valid_step: 1,
        completion_timestamp: null,
        continuity_checkpoint: {
          restartedAt: new Date().toISOString(),
          reason: confirmation.reason,
          restartCount,
        },
        restart_count: restartCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ restarted: true, restartCount, redirectTo: "/onboarding" })
}