"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type ApplicationPack = {
  jobTitle?: string | null
  jobCompany?: string | null
  matchScore?: number
  matchExplanation?: string | null
  cvPreview?: string | null
  coverLetterText?: string | null
  cvApprovalStatus?: string
  coverLetterApprovalStatus?: string
  interviewReadiness?: string | null
  riskWarnings?: string[]
}

export default function ApplicationPackStage() {
  const router = useRouter()
  const [appPack, setAppPack] = useState<ApplicationPack | null>(null)
  const [loading, setLoading] = useState(true)
  const [cvApproved, setCvApproved] = useState(false)
  const [coverLetterApproved, setCoverLetterApproved] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const loadAppPack = async () => {
      try {
        const res = await fetch("/api/career/application-pack", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setAppPack(data)
          setCvApproved(data?.cvApprovalStatus === "approved")
          setCoverLetterApproved(data?.coverLetterApprovalStatus === "approved")
        }
      } catch (err) {
        setStatus("Could not load application pack")
      } finally {
        setLoading(false)
      }
    }
    loadAppPack()
  }, [])

  const handleApproveCV = async () => {
    const res = await fetch("/api/career/application-pack/approve-cv", {
      method: "POST",
      credentials: "include",
    })
    if (res.ok) {
      setCvApproved(true)
      setStatus("CV approved")
    }
  }

  const handleApproveCoverLetter = async () => {
    const res = await fetch("/api/career/application-pack/approve-cover-letter", {
      method: "POST",
      credentials: "include",
    })
    if (res.ok) {
      setCoverLetterApproved(true)
      setStatus("Cover letter approved")
    }
  }

  const handleStartInterview = async () => {
    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toStage: "interview-prep" }),
    })
    if (res.ok) {
      router.push("/career-activation/interview-prep")
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading application pack...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Application Pack</h1>
        <p>Complete your application with tailored CV, cover letter, and interview prep.</p>

        {appPack && (
          <div style={{ marginBottom: 24 }}>
            {/* Job Summary */}
            {appPack.jobTitle && (
              <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px 0" }}>{appPack.jobTitle}</h3>
                <p style={{ margin: 0, color: "#94a3b8" }}>{appPack.jobCompany}</p>
              </div>
            )}

            {/* Match Score */}
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Match Score: {appPack.matchScore || "N/A"}%</h3>
              <p>{appPack.matchExplanation || "Assessment pending"}</p>
            </div>

            {/* CV Section */}
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Tailored CV</h3>
                {cvApproved && <span style={{ color: "#10b981", fontWeight: "600" }}>âœ“ Approved</span>}
              </div>
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 0 }}>
                {appPack.cvPreview
                  ? appPack.cvPreview.substring(0, 200) + "..."
                  : "CV preview not available yet"}
              </p>
              {!cvApproved && (
                <button
                  onClick={handleApproveCV}
                  style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Approve CV
                </button>
              )}
            </div>

            {/* Cover Letter Section */}
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Cover Letter</h3>
                {coverLetterApproved ? (
                  <span style={{ color: "#10b981", fontWeight: "600" }}>âœ“ Approved</span>
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>Not generated yet</span>
                )}
              </div>
              {appPack.coverLetterText ? (
                <>
                  <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 0 }}>
                    {appPack.coverLetterText.substring(0, 200)}...
                  </p>
                  {!coverLetterApproved && (
                    <button
                      onClick={handleApproveCoverLetter}
                      style={{
                        marginTop: 12,
                        padding: "8px 12px",
                        background: "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      Generate Cover Letter
                    </button>
                  )}
                </>
              ) : (
                <p style={{ color: "#94a3b8", margin: 0 }}>Not generated yet</p>
              )}
            </div>

            {/* Interview Prep */}
            <div style={{ background: "#0b1020", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>Interview Readiness</h3>
              <p style={{ color: "#94a3b8" }}>
                {appPack.interviewReadiness || "Preparation available in next stage"}
              </p>
            </div>

            {/* Risk Warnings */}
            {appPack.riskWarnings && appPack.riskWarnings.length > 0 && (
              <div style={{ background: "#1e1a2e", padding: 16, borderRadius: 6, marginBottom: 16, borderLeft: "4px solid #f59e0b" }}>
                <h3 style={{ margin: "0 0 8px 0", color: "#f59e0b" }}>Considerations</h3>
                <ul style={{ margin: "0 0 0 20px", color: "#cbd5e1" }}>
                  {appPack.riskWarnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleStartInterview}
            style={{
              flex: 1,
              padding: "12px 24px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Continue to Interview Prep
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
          Ready for manual submission. Do not auto-submit in the pilot.
        </p>

        {status && (
          <div style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 6 }}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
