"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type InterviewPreparation = {
  companyOverview?: string
  keyQuestions?: string[]
  learningSprintStarted?: boolean
}

export default function InterviewPrepStage() {
  const router = useRouter()
  const [prep, setPrep] = useState<InterviewPreparation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sprintStarted, setSprintStarted] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const loadPrep = async () => {
      try {
        const res = await fetch("/api/career/interview-prep", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setPrep(data)
          setSprintStarted(data?.learningSprintStarted || false)
        }
      } catch (err) {
        setStatus("Could not load interview prep")
      } finally {
        setLoading(false)
      }
    }
    loadPrep()
  }, [])

  const handleStartSprint = async () => {
    const res = await fetch("/api/career/interview-prep/start-sprint", {
      method: "POST",
      credentials: "include",
    })
    if (res.ok) {
      setSprintStarted(true)
      setStatus("Learning sprint started")
    }
  }

  const handleComplete = async () => {
    // Mark entire career activation as complete
    await fetch("/api/career/mark-complete", {
      method: "POST",
      credentials: "include",
    })
    router.push("/dashboard")
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading interview preparation...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Interview Preparation</h1>
        <p>Get ready for your interview with tailored preparation materials.</p>

        {prep && (
          <div style={{ marginBottom: 24 }}>
            {/* Company Overview */}
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>Company Overview</h3>
              <p style={{ margin: 0, color: "#94a3b8" }}>
                {prep.companyOverview || "Research the company's mission, culture, and recent news."}
              </p>
            </div>

            {/* Key Questions */}
            {prep.keyQuestions && Array.isArray(prep.keyQuestions) && (
              <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 12px 0" }}>Expected Interview Questions</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {prep.keyQuestions.map((q: string, i: number) => (
                    <div key={i} style={{ background: "#0f1729", padding: 12, borderRadius: 4 }}>
                      <p style={{ margin: 0, color: "#cbd5e1", fontSize: 14 }}>{q}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Learning Sprint */}
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Learning Sprint</h3>
                {sprintStarted && <span style={{ color: "#10b981", fontWeight: "600" }}>âœ“ Started</span>}
              </div>
              <p style={{ margin: "0 0 12px 0", color: "#94a3b8" }}>
                Complete a structured learning path to fill skill gaps identified in the job assessment.
              </p>
              {!sprintStarted && (
                <button
                  onClick={handleStartSprint}
                  style={{
                    padding: "8px 12px",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Start Learning Sprint
                </button>
              )}
            </div>

            {/* Next Steps */}
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 12px 0" }}>Next Steps</h3>
              <ol style={{ margin: 0, paddingLeft: 20, color: "#cbd5e1" }}>
                <li>Review your tailored CV and cover letter</li>
                <li>Research the company and role thoroughly</li>
                <li>Practice answers to expected questions</li>
                <li>Complete the learning sprint</li>
                <li>Submit your application when ready</li>
              </ol>
            </div>
          </div>
        )}

        <button
          onClick={handleComplete}
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
          Complete & Return to Dashboard
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
