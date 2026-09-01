"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type ChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"

type ChangeRecord = {
  id: string
  section: string
  originalText: string
  proposedText: string
  reason: string
  sourceEvidence: string
  confidence: number
  userApprovalStatus: ChangeStatus
}

type ChangesPayload = {
  changes?: ChangeRecord[]
  change?: ChangeRecord
  error?: string
}

export default function CvImprovementsStage() {
  const router = useRouter()

  const [changes, setChanges] =
    useState<ChangeRecord[]>([])

  const [loading, setLoading] =
    useState(true)

  const [decisionLoading, setDecisionLoading] =
    useState<string | null>(null)

  const [status, setStatus] =
    useState("")

  useEffect(() => {
    const loadChanges = async () => {
      try {
        const response = await fetch(
          "/api/career/cv-changes",
          {
            credentials: "include",
          }
        )

        const payload =
          (await response.json().catch(
            () => ({})
          )) as ChangesPayload

        if (!response.ok) {
          setStatus(
            payload.error ||
              "Could not load CV improvements."
          )
          return
        }

        setChanges(payload.changes || [])
      } catch {
        setStatus(
          "Could not load CV improvements."
        )
      } finally {
        setLoading(false)
      }
    }

    void loadChanges()
  }, [])

  const handleDecision = async (
    changeId: string,
    action: "approved" | "rejected"
  ) => {
    setDecisionLoading(changeId)
    setStatus("")

    try {
      const response = await fetch(
        "/api/career/cv-changes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            changeId,
            action,
          }),
        }
      )

      const payload =
        (await response.json().catch(
          () => ({})
        )) as ChangesPayload

      if (!response.ok) {
        setStatus(
          payload.error ||
            "The CV improvement decision could not be saved."
        )
        return
      }

      setChanges((current) =>
        current.map((change) =>
          change.id === changeId
            ? payload.change || {
                ...change,
                userApprovalStatus: action,
              }
            : change
        )
      )

      setStatus(
        action === "approved"
          ? "Improvement approved."
          : "Improvement rejected."
      )
    } catch {
      setStatus(
        "The CV improvement decision could not be saved."
      )
    } finally {
      setDecisionLoading(null)
    }
  }

  const handleContinue = async () => {
    const pending =
      changes.filter(
        (change) =>
          change.userApprovalStatus === "pending"
      ).length

    if (pending > 0) {
      setStatus(
        `Review the remaining ${pending} ` +
          `improvement${pending === 1 ? "" : "s"} ` +
          "before continuing."
      )
      return
    }

    const response = await fetch(
      "/api/career/stage-transition",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          toStage: "career-summary",
        }),
      }
    )

    if (response.ok) {
      router.push(
        "/career-activation/career-summary"
      )
      return
    }

    const payload =
      (await response.json().catch(
        () => ({})
      )) as {
        error?: string
      }

    setStatus(
      payload.error ||
        "Could not continue to the career summary."
    )
  }

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 24,
        }}
      >
        Loading improvements...
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          border: "1px solid #334155",
          borderRadius: 8,
          padding: 24,
          background: "#111827",
        }}
      >
        <h1 style={{ marginTop: 0 }}>
          CV Improvements
        </h1>

        <p>
          Review each evidence-based suggestion.
          Nothing is applied without your approval.
        </p>

        {changes.length === 0 ? (
          <div
            style={{
              background: "#0b1220",
              padding: 16,
              borderRadius: 6,
              marginBottom: 20,
            }}
          >
            <p>
              No evidence-based improvements were
              generated. Return to CV Intake if the
              profile requires more information.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {changes.map((change) => {
              const deciding =
                decisionLoading === change.id

              return (
                <div
                  key={change.id}
                  style={{
                    background: "#0b1220",
                    padding: 16,
                    borderRadius: 6,
                    marginBottom: 12,
                    border:
                      change.userApprovalStatus ===
                      "approved"
                        ? "1px solid #10b981"
                        : change.userApprovalStatus ===
                            "rejected"
                          ? "1px solid #ef4444"
                          : "1px solid #475569",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        textTransform: "capitalize",
                      }}
                    >
                      {change.section.replaceAll(
                        "_",
                        " "
                      )}
                    </h4>

                    <span
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                      }}
                    >
                      Confidence:{" "}
                      {Math.round(
                        change.confidence * 100
                      )}
                      %
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: "#cbd5e1",
                      marginBottom: 8,
                    }}
                  >
                    {change.reason}
                  </p>

                  <div
                    style={{
                      background: "#111827",
                      padding: 10,
                      borderRadius: 4,
                      marginBottom: 12,
                      fontSize: 12,
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        color: "#94a3b8",
                      }}
                    >
                      Original
                    </p>

                    <p
                      style={{
                        margin: 0,
                        color: "#f8fafc",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {change.originalText}
                    </p>

                    <p
                      style={{
                        margin: "12px 0 6px",
                        color: "#10b981",
                      }}
                    >
                      Proposed
                    </p>

                    <p
                      style={{
                        margin: 0,
                        color: "#f8fafc",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {change.proposedText}
                    </p>

                    <p
                      style={{
                        margin: "12px 0 4px",
                        color: "#94a3b8",
                      }}
                    >
                      Evidence used
                    </p>

                    <p
                      style={{
                        margin: 0,
                        color: "#cbd5e1",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {change.sourceEvidence}
                    </p>
                  </div>

                  {change.userApprovalStatus ===
                    "pending" && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        disabled={
                          decisionLoading !== null
                        }
                        onClick={() =>
                          void handleDecision(
                            change.id,
                            "approved"
                          )
                        }
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          background: deciding
                            ? "#475569"
                            : "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor:
                            decisionLoading !== null
                              ? "not-allowed"
                              : "pointer",
                          fontSize: 14,
                        }}
                      >
                        {deciding
                          ? "Saving..."
                          : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          decisionLoading !== null
                        }
                        onClick={() =>
                          void handleDecision(
                            change.id,
                            "rejected"
                          )
                        }
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          background: deciding
                            ? "#475569"
                            : "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor:
                            decisionLoading !== null
                              ? "not-allowed"
                              : "pointer",
                          fontSize: 14,
                        }}
                      >
                        {deciding
                          ? "Saving..."
                          : "Reject"}
                      </button>
                    </div>
                  )}

                  {change.userApprovalStatus !==
                    "pending" && (
                    <div
                      role="status"
                      style={{
                        padding: "8px 12px",
                        background: "#0f172a",
                        borderRadius: 4,
                        fontSize: 12,
                        color:
                          change.userApprovalStatus ===
                          "approved"
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      {change.userApprovalStatus ===
                      "approved"
                        ? "Approved"
                        : "Rejected"}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          disabled={decisionLoading !== null}
          onClick={() =>
            void handleContinue()
          }
          style={{
            padding: "12px 24px",
            background:
              decisionLoading !== null
                ? "#475569"
                : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor:
              decisionLoading !== null
                ? "not-allowed"
                : "pointer",
            width: "100%",
          }}
        >
          Continue to Career Summary
        </button>

        {status && (
          <div
            role="status"
            style={{
              marginTop: 16,
              padding: 12,
              background: "#1e293b",
              borderRadius: 6,
            }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  )
}