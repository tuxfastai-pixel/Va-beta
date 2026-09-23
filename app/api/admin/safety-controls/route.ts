import { NextRequest, NextResponse } from "next/server"
import {
  loadDeploymentSafetyConfig,
  saveDeploymentSafetyConfig,
} from "@/lib/governance/deploymentSafetyStore"
import {
  loadFeatureRolloutPolicy,
  saveFeatureRolloutPolicy,
} from "@/lib/governance/featureRolloutStore"
import {
  loadPersonalizationRolloutPolicy,
  savePersonalizationRolloutPolicy,
} from "@/lib/personalization/personalizationRolloutStore"
import { requireAdminRole, requireFounderRole } from "@/lib/auth/serverAuth"

export async function GET() {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const config = await loadDeploymentSafetyConfig()
    const rolloutPolicy = await loadFeatureRolloutPolicy()
    const personalizationRolloutPolicy = await loadPersonalizationRolloutPolicy()
    return NextResponse.json({ config, rolloutPolicy, personalizationRolloutPolicy })
  } catch (error) {
    console.error("safety-controls GET error:", error)
    return NextResponse.json({ error: "Failed to load safety controls" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const body = (await req.json()) as {
      reason?: string
      disableAdaptiveWorkspace?: boolean
      disableOrchestration?: boolean
      disableAutonomousPacing?: boolean
      forceBalancedMode?: boolean
      forceQuietNotifications?: boolean
      emergencyRollback?: boolean
      safeMode?: boolean
      operationalMode?: "shadow_only" | "assistive_only" | "regulated_autonomy" | "full_autonomy" | "recovery_priority"
      rolloutPolicy?: {
        enabled?: boolean
        mode?: "percentage" | "cohort" | "internal-only" | "recovery-only" | "shadow-mode"
        percentage?: number
        allowedCohorts?: string[]
        internalUserIds?: string[]
      }
      personalizationRolloutPolicy?: {
        enabled?: boolean
        mode?: "percentage" | "cohort" | "internal-only" | "recovery-only" | "shadow-mode"
        percentage?: number
        allowedCohorts?: string[]
        internalUserIds?: string[]
      }
    }

    if (body.emergencyRollback) {
      const founderAuth = await requireFounderRole()
      if ("response" in founderAuth) return founderAuth.response
    }

    const config = await saveDeploymentSafetyConfig({
      ...body,
      reason: body.reason ?? null,
      updatedAt: new Date(),
    })

    const rolloutPolicy = body.rolloutPolicy
      ? await saveFeatureRolloutPolicy(body.rolloutPolicy)
      : await loadFeatureRolloutPolicy()
    const personalizationRolloutPolicy = body.personalizationRolloutPolicy
      ? await savePersonalizationRolloutPolicy(body.personalizationRolloutPolicy)
      : await loadPersonalizationRolloutPolicy()

    return NextResponse.json({ config, rolloutPolicy, personalizationRolloutPolicy })
  } catch (error) {
    console.error("safety-controls POST error:", error)
    return NextResponse.json({ error: "Failed to update safety controls" }, { status: 500 })
  }
}
