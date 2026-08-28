import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { buildContinuityCheckpoint, sanitizeStep, type OnboardingProgressPayload } from "@/lib/career/activationContinuity"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

type StateBody = {
  step?: number
  payload?: OnboardingProgressPayload
}

const TABLE = "career_activation_states"

export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data, error } = await supabaseServer
    .from(TABLE)
    .select("*")
    .eq("user_id", session.userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ state: data || null })
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as StateBody
  const step = sanitizeStep(Number(body.step || 1))
  const payload = body.payload

  const checkpoint = payload
    ? buildContinuityCheckpoint({
        userId: session.userId,
        completedStep: step,
        payload,
      })
    : null

  const updates: Record<string, unknown> = {
    user_id: session.userId,
    completed_step: Math.max(0, Math.min(5, step)),
    last_valid_step: step,
    updated_at: new Date().toISOString(),
  }

  if (payload) {
    updates.answers = payload
    updates.career_lanes = {
      selected: payload.selectedCareers,
      primary: payload.primaryCareer,
      secondary: payload.secondaryCareers,
    }
    updates.payment_readiness = payload.paymentReadiness
    updates.international_readiness = payload.internationalReadiness
    if (checkpoint) {
      updates.continuity_checkpoint = checkpoint
    }
  }

  const { data, error } = await supabaseServer
    .from(TABLE)
    .upsert(updates, { onConflict: "user_id" })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: true, state: data })
}