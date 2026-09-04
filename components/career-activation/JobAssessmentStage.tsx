"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type JobAssessment = {
  matchScore?: number
  matchExplanation?: string
  strengths?: string[]
  missingSkills?: string[]
}

export default function JobAssessmentStage() {
  const router = useRouter()
  const [assessment, setAssessment] = useState<JobAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const loadAssessment = async () => {
      try {
        const res = await fetch("/api/career/job-assessment", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setAssessment(data)
        }
      } catch (err) {
        setStatus("Could not load assessment")
      } finally {
        setLoading(false)
      }
    }
    loadAssessment()
  }, [])

  const handleContinue = async () => {
    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toStage: "application-pack" }),
    })
    if (res.ok) {
      router.push("/career-activation/application-pack")
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading job assessment...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Job Assessment</h1>
        <p>Here&apos;s how you match with the selected job.</p>

        {assessment && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Match Score</h3>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#3b82f6", marginBottom: 8 }}>
                {assessment.matchScore || "N/A"}%
              </div>
              <p style={{ color: "#cbd5e1", marginTop: 0 }}>
                {assessment.matchExplanation || "Assessment pending"}
              </p>
            </div>

            {assessment.strengths && (
              <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: "#10b981" }}>Your Strengths</h3>
                <ul style={{ margin: "12px 0 0 20px", color: "#cbd5e1" }}>
                  {assessment.strengths.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {assessment.missingSkills && (
              <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: "#f59e0b" }}>Skills to Develop</h3>
                <ul style={{ margin: "12px 0 0 20px", color: "#cbd5e1" }}>
                  {assessment.missingSkills.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
          Review Application Pack
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
