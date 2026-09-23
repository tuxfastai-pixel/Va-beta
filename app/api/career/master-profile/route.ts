import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import {
  applyProfileDetails,
  applySkillCandidateDecision,
  type CuratableProfile,
} from "@/lib/career/profileCuration"

type PatchBody =
  | {
      action: "skill_decision"
      skill?: string
      decision?: "confirm" | "reject"
      editedSkill?: string
    }
  | {
      action: "profile_details"
      professionalSummary?: string
      preferredRoles?: string[]
    }

async function authenticatedProfile() {
  const session = await getSessionUser()
  if (!session?.userId) {
    return { session: null, profile: null, error: "Unauthorized" }
  }

  const { data: profile, error } = await supabaseServer
    .from("master_career_profiles")
    .select("*")
    .eq("user_id", session.userId)
    .maybeSingle()

  return {
    session,
    profile,
    error: error?.message || null,
  }
}

export async function GET() {
  try {
    const result = await authenticatedProfile()
    if (!result.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (result.error) {
      console.error("master-profile fetch error:", result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ profile: result.profile })
  } catch (error) {
    console.error("master-profile error:", error)
    return NextResponse.json({ error: "Could not load profile" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await authenticatedProfile()
    if (!result.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    if (!result.profile) {
      return NextResponse.json({ error: "Career profile not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as PatchBody | null
    if (!body || !body.action) {
      return NextResponse.json({ error: "Invalid profile update" }, { status: 400 })
    }

    const current = (result.profile.structured_profile || {}) as CuratableProfile
    let structured: CuratableProfile

    if (body.action === "skill_decision") {
      const skill = String(body.skill || "").trim()
      if (!skill || (body.decision !== "confirm" && body.decision !== "reject")) {
        return NextResponse.json({ error: "A valid skill decision is required" }, { status: 400 })
      }
      structured = applySkillCandidateDecision(current, {
        skill,
        decision: body.decision,
        editedSkill: body.editedSkill,
      })
    } else if (body.action === "profile_details") {
      structured = applyProfileDetails(current, {
        professionalSummary: body.professionalSummary,
        preferredRoles: Array.isArray(body.preferredRoles) ? body.preferredRoles : [],
      })
    } else {
      return NextResponse.json({ error: "Unsupported profile update" }, { status: 400 })
    }

    const { data: updated, error } = await supabaseServer
      .from("master_career_profiles")
      .update({
        structured_profile: structured,
        updated_at: new Date().toISOString(),
      })
      .eq("id", result.profile.id)
      .eq("user_id", result.session.userId)
      .select("*")
      .single()

    if (error) {
      console.error("master-profile update error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update profile"
    const status = /not found|required|between|specific professional skill/i.test(message) ? 400 : 500
    console.error("master-profile patch error:", message)
    return NextResponse.json({ error: message }, { status })
  }
}
