import { NextResponse } from "next/server"
import { buildMonitoringSnapshot } from "@/lib/governance/equilibriumMonitoring"
import { listEquilibriumEvents } from "@/lib/telemetry/equilibriumEventStream"
import { aggregateEquilibriumEvents } from "@/lib/telemetry/equilibriumAggregator"
import { listPersonalizationStates } from "@/lib/personalization/personalizationStore"
import { requireAdminRole } from "@/lib/auth/serverAuth"

/**
 * GET /api/admin/equilibrium-monitoring
 * Returns live-ish equilibrium observability snapshot for admin monitoring.
 */
export async function GET() {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const now = Date.now()
    const telemetryEvents = await listEquilibriumEvents({
      sinceTimestamp: now - 1000 * 60 * 60 * 24,
      limit: 20_000,
    })

    const snapshot = buildMonitoringSnapshot(new Date())
    const telemetry = aggregateEquilibriumEvents(telemetryEvents, now)
    const personalizationStates = await listPersonalizationStates(200)

    const personalization = {
      profiledUsers: personalizationStates.length,
      avgAdaptationConfidence:
        personalizationStates.length > 0
          ? personalizationStates.reduce((sum, state) => sum + state.identity.adaptationConfidence, 0) /
            personalizationStates.length
          : 0,
      avgTrustStability:
        personalizationStates.length > 0
          ? personalizationStates.reduce((sum, state) => sum + state.trust.trustStability, 0) /
            personalizationStates.length
          : 0,
      styles: {
        pacing: personalizationStates.reduce<Record<string, number>>((acc, state) => {
          acc[state.identity.pacingStyle] = (acc[state.identity.pacingStyle] || 0) + 1
          return acc
        }, {}),
        recovery: personalizationStates.reduce<Record<string, number>>((acc, state) => {
          acc[state.identity.recoveryStyle] = (acc[state.identity.recoveryStyle] || 0) + 1
          return acc
        }, {}),
      },
    }

    return NextResponse.json({
      snapshot,
      telemetry,
      personalization,
      status: "ok",
    })
  } catch (error) {
    console.error("equilibrium-monitoring error:", error)
    return NextResponse.json(
      { error: "Failed to build equilibrium monitoring snapshot" },
      { status: 500 },
    )
  }
}
