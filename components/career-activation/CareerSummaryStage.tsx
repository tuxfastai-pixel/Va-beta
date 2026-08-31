"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type CareerSummary = {
  careerLanes?: {
    primary?: string | null
    secondary?: string | null
  } | null
  readiness?: {
    paymentReadiness?: string
    internationalReadiness?: string
    remoteReadiness?: string
  }
  skills?: string[]
  professionalSummary?: string | null
  missingFields?: string[]
}

export default function CareerSummaryStage() {
  const router = useRouter()
  const [summary, setSummary] = useState<CareerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const res = await fetch("/api/career/career-summary", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setSummary(data)
        } else {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          setStatus(
            payload.error ||
              "Could not load the career summary."
          )
        }
      } catch (err) {
        setStatus("Could not load career summary")
      } finally {
        setLoading(false)
      }
    }
    loadSummary()
  }, [])

  const handleContinue = async () => {
    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toStage: "job-discovery" }),
    })
    if (res.ok) {
      router.push("/career-activation/job-discovery")
      return
    }

    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
    }

    setStatus(
      payload.error ||
        "Could not continue to job discovery."
    )
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading career summary...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Your Career Identity</h1>
        <p>Here&apos;s a summary of your career profile, readiness, and opportunities.</p>

        <div style={{ marginBottom: 24 }}>
          {summary?.careerLanes && (
            <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Career Lanes</h3>
              <p><strong>Primary:</strong> {summary.careerLanes.primary || "Not set"}</p>
              {summary.careerLanes.secondary && <p><strong>Secondary:</strong> {summary.careerLanes.secondary}</p>}
            </div>
          )}

          {summary?.readiness && (
            <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Your Readiness</h3>
              <p><strong>Payment:</strong> {summary.readiness.paymentReadiness || "N/A"}</p>
              <p><strong>International:</strong> {summary.readiness.internationalReadiness || "N/A"}</p>
              <p><strong>Remote:</strong> {summary.readiness.remoteReadiness || "N/A"}</p>
            </div>
          )}

          {summary?.professionalSummary && (
            <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Professional Summary</h3>
              <p>{summary.professionalSummary}</p>
            </div>
          )}

          {summary?.skills && Array.isArray(summary.skills) && (
            <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Key Skills</h3>
              <p>{summary.skills.join(", ")}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleContinue}
          style={{
            padding: "12px 24px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: "600",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Find Jobs
        </button>

        {status && (
          <div style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 6 }}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
