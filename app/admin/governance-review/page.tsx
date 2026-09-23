"use client"

import { useCallback, useEffect, useState } from "react"

type ReviewPayload = {
  aggregation?: {
    anomalies: Array<{ kind: string; severity: string; description: string }>
    metrics: {
      suppressionAccuracy: number
      sessionContinuityRetention: number
      downshiftTimingAccuracy: number
    }
  }
  rollback?: {
    triggered: boolean
    reason: string
  }
  interventions?: Array<{
    id: string
    timestamp: number
    actor: string
    action: string
    rationale: string
  }>
}

export default function GovernanceReviewPage() {
  const [data, setData] = useState<ReviewPayload>({})
  const [loading, setLoading] = useState(true)
  const [actor, setActor] = useState("admin")
  const [action, setAction] = useState("")
  const [rationale, setRationale] = useState("")

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    }
    try {
      const response = await fetch("/api/admin/governance-review")
      const payload = (await response.json()) as ReviewPayload
      setData(payload)
    } catch (error) {
      console.error("Failed to load governance review", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load(false)
    })
  }, [load])

  async function submitIntervention() {
    if (!action || !rationale) {
      return
    }

    try {
      await fetch("/api/admin/governance-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, action, rationale }),
      })

      setAction("")
      setRationale("")
      await load(false)
    } catch (error) {
      console.error("Failed to submit intervention", error)
    }
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading governance review...</main>
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>Governance Review Console</h1>
      <p style={{ color: "#475569", marginBottom: 20 }}>
        Human review layer for telemetry anomalies, rollback recommendation, and intervention audit.
      </p>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Autonomous rollback recommendation</h2>
        <p>
          Triggered: <strong>{data.rollback?.triggered ? "Yes" : "No"}</strong>
        </p>
        <p style={{ marginBottom: 0 }}>{data.rollback?.reason ?? "No recommendation available."}</p>
        {data.rollback?.triggered && (
          <button
            onClick={async () => {
              await fetch("/api/admin/governance-review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  actor,
                  action: "apply_autonomous_rollback",
                  rationale: data.rollback?.reason ?? "Rollback requested from review console",
                }),
              })
              await load(false)
            }}
            style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, border: "1px solid #7f1d1d" }}
          >
            Apply rollback recommendation
          </button>
        )}
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Current anomalies</h2>
        {(data.aggregation?.anomalies ?? []).length === 0 && <p>No anomalies detected.</p>}
        {(data.aggregation?.anomalies ?? []).map((anomaly, index) => (
          <article key={`${anomaly.kind}-${index}`} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
            <p style={{ margin: 0 }}>
              <strong>{anomaly.kind}</strong> ({anomaly.severity})
            </p>
            <p style={{ marginTop: 6 }}>{anomaly.description}</p>
          </article>
        ))}
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Log intervention</h2>
        <input
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          placeholder="Actor"
          style={{ width: "100%", marginBottom: 8, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
        />
        <input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Action"
          style={{ width: "100%", marginBottom: 8, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
        />
        <textarea
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          placeholder="Rationale"
          rows={3}
          style={{ width: "100%", marginBottom: 10, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
        />
        <button onClick={submitIntervention} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #0f172a" }}>
          Submit intervention
        </button>
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Intervention history</h2>
        {(data.interventions ?? []).slice(0, 20).map((item) => (
          <article key={item.id} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
            <p style={{ margin: 0 }}>
              <strong>{item.action}</strong> by {item.actor}
            </p>
            <p style={{ margin: "6px 0" }}>{item.rationale}</p>
            <small>{new Date(item.timestamp).toLocaleString()}</small>
          </article>
        ))}
      </section>
    </main>
  )
}
