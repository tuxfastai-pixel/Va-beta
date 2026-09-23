import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [profileResult, activationResult] = await Promise.all([
      supabaseServer
        .from("master_career_profiles")
        .select("structured_profile")
        .eq("user_id", session.userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseServer
        .from("career_activation_states")
        .select("career_lanes, payment_readiness, international_readiness")
        .eq("user_id", session.userId)
        .maybeSingle(),
    ])

    if (profileResult.error) {
      return NextResponse.json(
        { error: profileResult.error.message },
        { status: 500 }
      )
    }

    if (activationResult.error) {
      return NextResponse.json(
        { error: activationResult.error.message },
        { status: 500 }
      )
    }

    const structured =
      (profileResult.data?.structured_profile || {}) as Record<string, unknown>

    const careerLanes =
      (activationResult.data?.career_lanes || {}) as Record<string, unknown>

    const payment =
      (activationResult.data?.payment_readiness || {}) as Record<string, unknown>

    const international =
      (activationResult.data?.international_readiness || {}) as Record<string, unknown>

    return NextResponse.json({
      careerLanes: {
        primary: String(careerLanes.primary || "") || null,
        secondary: Array.isArray(careerLanes.secondary)
          ? careerLanes.secondary
          : [],
      },
      readiness: {
        paymentReadiness:
          payment.paymentReadinessScore === undefined
            ? "Not assessed"
            : `${Number(payment.paymentReadinessScore)}%`,
        internationalReadiness:
          international.internationalReadinessScore === undefined
            ? "Not assessed"
            : `${Number(international.internationalReadinessScore)}%`,
        remoteReadiness:
          international.remoteReadinessScore === undefined
            ? "Not assessed"
            : `${Number(international.remoteReadinessScore)}%`,
      },
      skills: Array.isArray(structured.skills)
        ? structured.skills
        : [],
      professionalSummary:
        String(structured.professionalSummary || "") || null,
      missingFields: Array.isArray(structured.missingFields)
        ? structured.missingFields
        : [],
    })
  } catch (error) {
    console.error("career-summary error:", error)
    return NextResponse.json(
      { error: "Could not load the career summary." },
      { status: 500 }
    )
  }
}