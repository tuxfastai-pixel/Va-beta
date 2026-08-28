import { NextRequest, NextResponse } from "next/server"
import { listEquilibriumEvents } from "@/lib/telemetry/equilibriumEventStream"
import { loadTrustHistoryRecord, listTrustHistoryRecords, summarizeTrustHistory } from "@/lib/trust/trustHistoryStore"
import { listGovernanceInterventions } from "@/lib/governance/governanceInterventionLog"
import { listShadowModeDecisions } from "@/lib/governance/shadowModeDecisionLog"
import { replayHumanSession } from "@/lib/replay/humanSessionReplay"
import { requireAdminRole } from "@/lib/auth/serverAuth"

function uniqueUserIdsFromEvents(events: Awaited<ReturnType<typeof listEquilibriumEvents>>): string[] {
  const ids = new Set<string>()
  for (const event of events) {
    if (event.userId?.trim()) {
      ids.add(event.userId.trim())
    }
  }
  return Array.from(ids)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if ("response" in auth) return auth.response

    const userIdQuery = request.nextUrl.searchParams.get("userId")?.trim() || null
    const regimeQuery = request.nextUrl.searchParams.get("regime")?.trim() || null
    const hoursQuery = Number(request.nextUrl.searchParams.get("hours") ?? 24)
    const hours = Number.isFinite(hoursQuery) ? Math.max(1, Math.min(168, hoursQuery)) : 24
    const now = Date.now()
    const sinceTimestamp = now - hours * 60 * 60 * 1000

    const eventLimitQuery = Number(request.nextUrl.searchParams.get("eventLimit") ?? 6000)
    const eventLimit = Number.isFinite(eventLimitQuery) ? Math.max(200, Math.min(20000, eventLimitQuery)) : 6000

    const [events, interventions, shadowLog] = await Promise.all([
      listEquilibriumEvents({ sinceTimestamp, limit: eventLimit }),
      listGovernanceInterventions(2000),
      listShadowModeDecisions(2000),
    ])

    const targetUserIds = userIdQuery
      ? [userIdQuery]
      : (() => {
          const fromEvents = uniqueUserIdsFromEvents(events)
          if (fromEvents.length > 0) {
            return fromEvents.slice(0, 10)
          }
          return []
        })()

    if (targetUserIds.length === 0) {
      const trustRecords = await listTrustHistoryRecords(10)
      targetUserIds.push(...trustRecords.map((record) => record.userId))
    }

    const reports = [] as Array<{
      userId: string
      regime: string
      replay: ReturnType<typeof replayHumanSession>
      shadowDecisions: Awaited<ReturnType<typeof listShadowModeDecisions>>
    }>

    for (const userId of targetUserIds) {
      const userEvents = events.filter((event) => event.userId === userId).sort((a, b) => a.timestamp - b.timestamp)
      if (userEvents.length === 0) {
        continue
      }

      const trustRecord = await loadTrustHistoryRecord(userId)
      const summary = summarizeTrustHistory(trustRecord)
      if (regimeQuery && regimeQuery !== summary.trustRegime) {
        continue
      }

      const replay = replayHumanSession({
        userId,
        events: userEvents,
        trustWindows: trustRecord.trustWindows,
        interventions,
      })

      const shadowDecisions = shadowLog
        .filter((entry) => entry.userId === userId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 120)

      reports.push({ userId, regime: summary.trustRegime, replay, shadowDecisions })
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      windowHours: hours,
      filters: {
        userId: userIdQuery,
        regime: regimeQuery,
      },
      reports,
      status: "ok",
    })
  } catch (error) {
    console.error("replay-validation error:", error)
    return NextResponse.json({ error: "Failed to build replay validation report" }, { status: 500 })
  }
}
