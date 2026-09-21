"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type JobAssessment = {
  assessmentId: string
  jobTitle: string
  jobCompany?: string
  matchScore: number
  matchExplanation: string
  strengths: string[]
  missingSkills: string[]
  recommendationBand?: string
  scoreBreakdown?: Record<string, number>
}

export default function JobAssessmentStage() {
  const router = useRouter()
  const [assessment, setAssessment] = useState<JobAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/career/job-assessment", { credentials: "include" })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStatus(payload.error || "Choose a job before opening an assessment.")
        } else {
          setAssessment(payload)
        }
      } catch {
        setStatus("Could not load the assessment.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleContinue = async () => {
    if (!assessment) return

    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        toStage: "application-pack",
        stageData: {
          assessmentId: assessment.assessmentId,
          jobTitle: assessment.jobTitle,
        },
      }),
    })

    if (res.ok) {
      router.push("/career-activation/application-pack")
      return
    }

    const payload = await res.json().catch(() => ({}))
    setStatus(payload.error || "Could not open the application pack.")
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading job assessment...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Job Assessment</h1>

        {!assessment ? (
          <div style={{ background: "#0b1020", padding: 20, borderRadius: 8, border: "1px solid #f59e0b" }}>
            <h2 style={{ marginTop: 0, color: "#f59e0b" }}>A job is required</h2>
            <p>{status || "Select a recommended job or paste a job description to create a meaningful assessment."}</p>
            <button type="button" onClick={() => router.push("/career-activation/job-discovery")} style={{ padding: "12px 24px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              Choose or Paste a Job
            </button>
          </div>
        ) : (
          <>
            <p>
              Match for <strong>{assessment.jobTitle}</strong>
              {assessment.jobCompany ? ` at ${assessment.jobCompany}` : ""}.
            </p>

            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Evidence-based Match Score</h2>
              <div style={{ fontSize: 38, fontWeight: "bold", color: assessment.matchScore >= 70 ? "#10b981" : assessment.matchScore >= 45 ? "#f59e0b" : "#f87171", marginBottom: 8 }}>
                {assessment.matchScore}%
              </div>
              <p style={{ color: "#cbd5e1", margin: 0 }}>{assessment.matchExplanation}</p>
            </div>

            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h2 style={{ marginTop: 0, color: "#10b981", fontSize: 20 }}>Confirmed Strengths</h2>
              {assessment.strengths.length > 0 ? (
                <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
                  {assessment.strengths.map((skill) => <li key={skill}>{skill}</li>)}
                </ul>
              ) : (
                <p style={{ marginBottom: 0, color: "#cbd5e1" }}>No confirmed CV evidence matches the recognised requirements yet.</p>
              )}
            </div>

            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 20 }}>
              <h2 style={{ marginTop: 0, color: "#f59e0b", fontSize: 20 }}>Skills to Develop or Evidence</h2>
              {assessment.missingSkills.length > 0 ? (
                <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
                  {assessment.missingSkills.map((skill) => <li key={skill}>{skill}</li>)}
                </ul>
              ) : (
                <p style={{ marginBottom: 0, color: "#cbd5e1" }}>No recognised skill gaps were found.</p>
              )}
            </div>

            <button type="button" onClick={() => void handleContinue()} style={{ padding: "12px 24px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%" }}>
              Build Application Pack
            </button>

            <button type="button" onClick={() => router.push("/career-activation/job-discovery")} style={{ marginTop: 10, padding: "10px 20px", background: "transparent", color: "#93c5fd", border: "1px solid #475569", borderRadius: 6, cursor: "pointer", width: "100%" }}>
              Assess a Different Job
            </button>

            {status && <div role="status" style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 6 }}>{status}</div>}
          </>
        )}
      </div>
    </div>
  )
}
