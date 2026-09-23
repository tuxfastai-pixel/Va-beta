import { NextRequest } from "next/server"
import { buildTrustMonitoringSnapshot } from "@/lib/trust/trustMonitoringSnapshot"
import { requireAdminRole } from "@/lib/auth/serverAuth"

export const runtime = "nodejs"

const MAX_GLOBAL_CONNECTIONS = 80
const MAX_CONNECTIONS_PER_CLIENT = 3
const activeConnectionCounts = new Map<string, number>()
let activeGlobalConnections = 0

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || "unknown"
  const agent = request.headers.get("user-agent") || "unknown-agent"
  return `${ip}:${agent.slice(0, 120)}`
}

function acquireConnectionSlot(clientKey: string): boolean {
  const currentClient = activeConnectionCounts.get(clientKey) || 0
  if (currentClient >= MAX_CONNECTIONS_PER_CLIENT) {
    return false
  }

  if (activeGlobalConnections >= MAX_GLOBAL_CONNECTIONS) {
    return false
  }

  activeConnectionCounts.set(clientKey, currentClient + 1)
  activeGlobalConnections += 1
  return true
}

function releaseConnectionSlot(clientKey: string): void {
  const currentClient = activeConnectionCounts.get(clientKey) || 0
  if (currentClient <= 1) {
    activeConnectionCounts.delete(clientKey)
  } else {
    activeConnectionCounts.set(clientKey, currentClient - 1)
  }

  activeGlobalConnections = Math.max(0, activeGlobalConnections - 1)
}

function encodeSseEvent(event: string, payload: unknown): Uint8Array {
  const data = JSON.stringify(payload)
  return new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`)
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRole()
  if ("response" in auth) return auth.response

  const intervalParam = request.nextUrl.searchParams.get("intervalMs")
  const intervalMs = Math.max(5_000, Math.min(60_000, Number(intervalParam ?? 15_000)))
  const limitParam = request.nextUrl.searchParams.get("limit")
  const limit = Math.max(10, Math.min(500, Number(limitParam ?? 120)))
  const clientKey = getClientKey(request)

  if (!acquireConnectionSlot(clientKey)) {
    return new Response(
      JSON.stringify({
        error: "Too many active trust stream connections",
        limits: {
          maxGlobalConnections: MAX_GLOBAL_CONNECTIONS,
          maxConnectionsPerClient: MAX_CONNECTIONS_PER_CLIENT,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "5",
        },
      },
    )
  }

  let slotReleased = false
  const releaseSlotOnce = () => {
    if (slotReleased) {
      return
    }
    slotReleased = true
    releaseConnectionSlot(clientKey)
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const sendSnapshot = async () => {
        try {
          const snapshot = await buildTrustMonitoringSnapshot(limit)
          controller.enqueue(encodeSseEvent("snapshot", snapshot))
        } catch (error) {
          controller.enqueue(
            encodeSseEvent("error", {
              message: "Failed to build trust monitoring snapshot",
              detail: String(error),
            }),
          )
        }
      }

      void sendSnapshot()
      const timer = setInterval(() => {
        void sendSnapshot()
      }, intervalMs)

      const heartbeat = setInterval(() => {
        controller.enqueue(encodeSseEvent("heartbeat", { ts: Date.now() }))
      }, 20_000)

      request.signal.addEventListener("abort", () => {
        if (closed) {
          return
        }
        closed = true
        clearInterval(timer)
        clearInterval(heartbeat)
        releaseSlotOnce()
        controller.close()
      })
    },
    cancel() {
      releaseSlotOnce()
      return undefined
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
