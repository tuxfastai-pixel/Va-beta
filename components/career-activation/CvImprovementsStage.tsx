"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type ChangeRecord = {
  id: string
  section: string
  originalText: string
  proposedText: string
  reason: string
  sourceEvidence: string
  confidence: number
  userApprovalStatus: "pending" | "approved" | "rejected" | "edited"
}

export default function CvImprovementsStage() {
  const router = useRouter()
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const loadChanges = async () => {
      try {
        const res = await fetch("/api/career/cv-changes", { credentials: "include" })
        if (res.ok) {
          const { changes: cvChanges } = await res.json()
          setChanges(cvChanges || [])
        }
      } catch (err) {
        setStatus("Could not load changes")
      } finally {
        setLoading(false)
      }
    }
    loadChanges()
  }, [])

  const handleApproveChange = async (changeId: string) => {
    const res = await fetch(`/api/career/cv-change/${changeId}/approve`, {
      method: "POST",
      credentials: "include",
    })
    if (res.ok) {
      setChanges((prev) =>
        prev.map((c) => (c.id === changeId ? { ...c, userApprovalStatus: "approved" } : c))
      )
    }
  }

  const handleRejectChange = async (changeId: string) => {
    const res = await fetch(`/api/career/cv-change/${changeId}/reject`, {
      method: "POST",
      credentials: "include",
    })
    if (res.ok) {
      setChanges((prev) =>
        prev.map((c) => (c.id === changeId ? { ...c, userApprovalStatus: "rejected" } : c))
      )
    }
  }

  const handleContinue = async () => {
    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toStage: "career-summary" }),
    })
    if (res.ok) {
      router.push("/career-activation/career-summary")
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading improvements...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>CV Improvements</h1>
        <p>Review and approve the AI&apos;s suggested CV improvements.</p>

        {changes.length === 0 ? (
          <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 20 }}>
            <p>No improvements suggested. Your CV is well-structured.</p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {changes.map((change) => (
              <div
                key={change.id}
                style={{
                  background: "#0b1220",
                  padding: 16,
                  borderRadius: 6,
                  marginBottom: 12,
                  border:
                    change.userApprovalStatus === "approved"
                      ? "1px solid #10b981"
                      : change.userApprovalStatus === "rejected"
                        ? "1px solid #ef4444"
                        : "1px solid #475569",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, textTransform: "capitalize" }}>{change.section}</h4>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Confidence: {Math.round(change.confidence * 100)}%</span>
                </div>
                <p style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 8 }}>{change.reason}</p>
                <div style={{ background: "#111827", padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
                  <p style={{ margin: "0 0 8px 0", color: "#94a3b8" }}>Original:</p>
                  <p style={{ margin: 0, color: "#f8fafc" }}>{change.originalText}</p>
                  <p style={{ margin: "8px 0 0 0", color: "#10b981" }}>Proposed:</p>
                  <p style={{ margin: 0, color: "#f8fafc" }}>{change.proposedText}</p>
                </div>

                {change.userApprovalStatus === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleApproveChange(change.id)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectChange(change.id)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {change.userApprovalStatus !== "pending" && (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "#0f172a",
                      borderRadius: 4,
                      fontSize: 12,
                      color: change.userApprovalStatus === "approved" ? "#10b981" : "#ef4444",
                    }}
                  >
                    {change.userApprovalStatus === "approved" ? "âœ“ Approved" : "âœ— Rejected"}
                  </div>
                )}
              </div>
            ))}
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
          Continue to Career Summary
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
