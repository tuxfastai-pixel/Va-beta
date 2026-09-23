import { NextRequest, NextResponse } from "next/server"
import { listEquilibriumEvents } from "@/lib/telemetry/equilibriumEventStream"
import { aggregateEquilibriumEvents } from "@/lib/telemetry/equilibriumAggregator"
import {
  listGovernanceInterventions,
  logGovernanceIntervention,
} from "@/lib/governance/governanceInterventionLog"
import { loadDeploymentSafetyConfig, saveDeploymentSafetyConfig } from "@/lib/governance/deploymentSafetyStore"
import { evaluateAutonomousRollback } from "@/lib/governance/autonomousRollback"
import {
  getPersonalizationState,
  listPersonalizationStates,
} from "@/lib/personalization/personalizationStore"
import { requireAdminRole, requireFounderRole } from "@/lib/auth/serverAuth"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const userId = req.nextUrl.searchParams.get("userId")
    const events = await listEquilibriumEvents({
      sinceTimestamp: Date.now() - 1000 * 60 * 60 * 24,
      limit: 20_000,
    })
    const aggregation = aggregateEquilibriumEvents(events)
    const currentConfig = await loadDeploymentSafetyConfig()
    const rollback = evaluateAutonomousRollback(aggregation, currentConfig)
    const interventions = await listGovernanceInterventions(200)
    const personalization = userId
      ? await getPersonalizationState(userId)
      : (await listPersonalizationStates(20)).map((state) => ({
          userId: state.userId,
          identity: state.identity,
          trust: state.trust,
          updatedAt: state.updatedAt,
        }))

    return NextResponse.json({
      aggregation,
      rollback,
      interventions,
      latestEvents: events.slice(0, 100),
      personalization,
    })
  } catch (error) {
    console.error("governance-review GET error:", error)
    return NextResponse.json({ error: "Failed to load governance review" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const body = (await req.json()) as {
      actor?: string
      action?: string
      rationale?: string
      metadata?: Record<string, unknown>
    }

    if (!body.action || !body.rationale) {
      return NextResponse.json({ error: "Missing action or rationale" }, { status: 400 })
    }

    if (body.action === "apply_autonomous_rollback") {
      const founderAuth = await requireFounderRole()
      if ("response" in founderAuth) return founderAuth.response

      const events = await listEquilibriumEvents({
        sinceTimestamp: Date.now() - 1000 * 60 * 60 * 24,
        limit: 20_000,
      })
      const aggregation = aggregateEquilibriumEvents(events)
      const currentConfig = await loadDeploymentSafetyConfig()
      const decision = evaluateAutonomousRollback(aggregation, currentConfig)

      if (decision.triggered) {
        await saveDeploymentSafetyConfig(decision.nextConfig)
      }
    }

    const entry = await logGovernanceIntervention({
      actor: body.actor ?? "admin",
      action: body.action,
      rationale: body.rationale,
      metadata: body.metadata,
    })

    return NextResponse.json({ intervention: entry })
  } catch (error) {
    console.error("governance-review POST error:", error)
    return NextResponse.json({ error: "Failed to log governance intervention" }, { status: 500 })
  }
}
