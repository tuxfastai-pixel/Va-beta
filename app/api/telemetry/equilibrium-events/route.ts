import { NextRequest, NextResponse } from "next/server"
import {
  appendEquilibriumEvent,
  appendEquilibriumEvents,
  listEquilibriumEvents,
  getEquilibriumEventStats,
  type EquilibriumEvent,
} from "@/lib/telemetry/equilibriumEventStream"
import { loadFeatureRolloutPolicy } from "@/lib/governance/featureRolloutStore"
import { isFeatureEnabledForUser } from "@/lib/governance/featureRollout"
import { ingestPersonalizationEvents } from "@/lib/personalization/personalizationEngine"
import { loadPersonalizationRolloutPolicy } from "@/lib/personalization/personalizationRolloutStore"

function eventAllowed(
  policy: Awaited<ReturnType<typeof loadFeatureRolloutPolicy>>,
  event: Partial<EquilibriumEvent> & Pick<EquilibriumEvent, "userId" | "eventType">,
) {
  return isFeatureEnabledForUser(policy, {
    userId: event.userId,
    cohort: typeof event.metadata?.cohort === "string" ? event.metadata.cohort : undefined,
    isInternalUser: typeof event.metadata?.internal === "boolean" ? event.metadata.internal : false,
    isInRecoveryMode: Boolean(event.recoveryTriggered),
  })
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") || undefined
    const eventType = req.nextUrl.searchParams.get("eventType") || undefined
    const sinceTimestampRaw = req.nextUrl.searchParams.get("since")
    const limitRaw = req.nextUrl.searchParams.get("limit")

    const events = await listEquilibriumEvents({
      userId,
      eventType,
      sinceTimestamp: sinceTimestampRaw ? Number(sinceTimestampRaw) : undefined,
      limit: limitRaw ? Number(limitRaw) : 200,
    })

    const stats = await getEquilibriumEventStats()
    return NextResponse.json({ events, stats })
  } catch (error) {
    console.error("telemetry events GET error:", error)
    return NextResponse.json({ error: "Failed to read telemetry events" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const rolloutPolicy = await loadFeatureRolloutPolicy()
    const personalizationRolloutPolicy = await loadPersonalizationRolloutPolicy()
    const body = (await req.json()) as {
      event?: Partial<EquilibriumEvent> & Pick<EquilibriumEvent, "userId" | "eventType">
      events?: Array<Partial<EquilibriumEvent> & Pick<EquilibriumEvent, "userId" | "eventType">>
    }

    if (Array.isArray(body.events)) {
      const allowedEvents = body.events.filter((event) => eventAllowed(rolloutPolicy, event))
      const stored = await appendEquilibriumEvents(allowedEvents)
      const personalizationEvents = stored.filter((event) => eventAllowed(personalizationRolloutPolicy, event))
      await ingestPersonalizationEvents(personalizationEvents)
      return NextResponse.json({ storedCount: stored.length })
    }

    if (!body.event) {
      return NextResponse.json({ error: "Missing event payload" }, { status: 400 })
    }

    if (!eventAllowed(rolloutPolicy, body.event)) {
      return NextResponse.json({ skipped: true, reason: "Event outside rollout policy" })
    }

    const stored = await appendEquilibriumEvent(body.event)
    if (eventAllowed(personalizationRolloutPolicy, stored)) {
      await ingestPersonalizationEvents([stored])
    }
    return NextResponse.json({ event: stored })
  } catch (error) {
    console.error("telemetry events POST error:", error)
    return NextResponse.json({ error: "Failed to persist telemetry event" }, { status: 500 })
  }
}
