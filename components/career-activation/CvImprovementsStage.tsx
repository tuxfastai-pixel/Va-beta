"use client"

import {
  useEffect,
  useState,
} from "react"
import { useRouter } from "next/navigation"

type ChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"

type ConfirmationStatus =
  | "not_required"
  | "needs_confirmation"
  | "confirmed"

type ConfirmationQuestion = {
  id: string
  prompt: string
}

type ConfirmationAnswers =
  Record<string, string>

type ChangeRecord = {
  id: string
  section: string
  originalText: string
  proposedText: string
  reason: string
  sourceEvidence: string
  confidence: number
  userApprovalStatus: ChangeStatus
  confirmationStatus: ConfirmationStatus
  confirmationQuestions:
    ConfirmationQuestion[]
  confirmationAnswers:
    ConfirmationAnswers
  confirmedEvidence: string
}

type ChangesPayload = {
  changes?: ChangeRecord[]
  change?: ChangeRecord
  error?: string
  missingQuestionIds?: string[]
}

type AnswersByChange =
  Record<string, ConfirmationAnswers>

export default function CvImprovementsStage() {
  const router = useRouter()

  const [changes, setChanges] =
    useState<ChangeRecord[]>([])

  const [answers, setAnswers] =
    useState<AnswersByChange>({})

  const [loading, setLoading] =
    useState(true)

  const [activeRequest, setActiveRequest] =
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

        const loaded =
          payload.changes || []

        setChanges(loaded)

        const loadedAnswers:
          AnswersByChange = {}

        for (const change of loaded) {
          loadedAnswers[change.id] =
            change.confirmationAnswers || {}
        }

        setAnswers(loadedAnswers)
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

  const replaceChange = (
    changeId: string,
    replacement?: ChangeRecord
  ) => {
    if (!replacement) {
      return
    }

    setChanges((current) =>
      current.map((change) =>
        change.id === changeId
          ? replacement
          : change
      )
    )
  }

  const setAnswer = (
    changeId: string,
    questionId: string,
    value: string
  ) => {
    setAnswers((current) => ({
      ...current,
      [changeId]: {
        ...(current[changeId] || {}),
        [questionId]: value,
      },
    }))
  }

  const handleConfirmation = async (
    change: ChangeRecord
  ) => {
    const changeAnswers =
      answers[change.id] || {}

    const unanswered =
      change.confirmationQuestions.filter(
        (question) =>
          !String(
            changeAnswers[question.id] || ""
          ).trim()
      )

    if (unanswered.length > 0) {
      setStatus(
        `Answer all ${change.confirmationQuestions.length} ` +
          "factual questions before reconstruction."
      )
      return
    }

    setActiveRequest(change.id)
    setStatus("")

    try {
      const response = await fetch(
        "/api/career/cv-changes",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            changeId: change.id,
            action: "confirm",
            answers: changeAnswers,
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
            "Could not reconstruct the CV entry."
        )
        return
      }

      replaceChange(
        change.id,
        payload.change
      )

      setStatus(
        "Your answers were verified and a new reconstruction was prepared. Review it before approval."
      )
    } catch {
      setStatus(
        "Could not reconstruct the CV entry."
      )
    } finally {
      setActiveRequest(null)
    }
  }

  const handleDecision = async (
    changeId: string,
    action: "approved" | "rejected"
  ) => {
    setActiveRequest(changeId)
    setStatus("")

    try {
      const response = await fetch(
        "/api/career/cv-changes",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
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
            "The CV decision could not be saved."
        )
        return
      }

      replaceChange(
        changeId,
        payload.change
      )

      setStatus(
        action === "approved"
          ? "Improvement approved."
          : "Improvement rejected."
      )
    } catch {
      setStatus(
        "The CV decision could not be saved."
      )
    } finally {
      setActiveRequest(null)
    }
  }

  const handleContinue = async () => {
    const unresolved =
      changes.filter(
        (change) =>
          change.userApprovalStatus ===
          "pending"
      ).length

    if (unresolved > 0) {
      setStatus(
        `Complete or reject the remaining ${unresolved} ` +
          `review${unresolved === 1 ? "" : "s"} ` +
          "before continuing."
      )
      return
    }

    setActiveRequest("continue")
    setStatus("")

    try {
      const response = await fetch(
        "/api/career/stage-transition",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
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
    } catch {
      setStatus(
        "Could not continue to the career summary."
      )
    } finally {
      setActiveRequest(null)
    }
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
          Uncertain duties must be confirmed before
          stronger wording can be approved.
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
            No evidence-based improvements were
            generated. Return to CV Intake if more
            career information is needed.
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {changes.map((change) => {
              const busy =
                activeRequest === change.id

              const needsConfirmation =
                change.confirmationStatus ===
                  "needs_confirmation" &&
                change.userApprovalStatus ===
                  "pending"

              const confirmed =
                change.confirmationStatus ===
                "confirmed"

              const borderColor =
                change.userApprovalStatus ===
                "approved"
                  ? "#10b981"
                  : change.userApprovalStatus ===
                      "rejected"
                    ? "#ef4444"
                    : needsConfirmation
                      ? "#f59e0b"
                      : "#475569"

              return (
                <section
                  key={change.id}
                  style={{
                    background: "#0b1220",
                    padding: 16,
                    borderRadius: 6,
                    marginBottom: 12,
                    border:
                      `1px solid ${borderColor}`,
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
                        textTransform:
                          "capitalize",
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
                        color: needsConfirmation
                          ? "#f59e0b"
                          : "#94a3b8",
                      }}
                    >
                      {needsConfirmation
                        ? "Needs confirmation"
                        : `Evidence confidence: ${
                            Math.round(
                              change.confidence *
                                100
                            )
                          }%`}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: "#cbd5e1",
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
                      Original CV evidence
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

                    {!needsConfirmation && (
                      <>
                        <p
                          style={{
                            margin:
                              "12px 0 6px",
                            color: "#10b981",
                          }}
                        >
                          {confirmed
                            ? "Verified reconstruction"
                            : "Proposed"}
                        </p>

                        <p
                          style={{
                            margin: 0,
                            color: "#f8fafc",
                            whiteSpace:
                              "pre-wrap",
                          }}
                        >
                          {change.proposedText}
                        </p>
                      </>
                    )}

                    <details
                      style={{
                        marginTop: 12,
                        color: "#94a3b8",
                      }}
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                        }}
                      >
                        View supporting CV evidence
                      </summary>

                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#cbd5e1",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {confirmed &&
                        change.confirmedEvidence
                          ? change.confirmedEvidence
                          : change.sourceEvidence}
                      </p>
                    </details>
                  </div>

                  {needsConfirmation && (
                    <div
                      style={{
                        padding: 12,
                        marginBottom: 12,
                        background: "#172033",
                        borderRadius: 6,
                      }}
                    >
                      <strong
                        style={{
                          color: "#fbbf24",
                        }}
                      >
                        Confirm what you actually did
                      </strong>

                      <p
                        style={{
                          fontSize: 12,
                          color: "#cbd5e1",
                        }}
                      >
                        These answers become evidence.
                        Do not include duties you did
                        not personally perform.
                      </p>

                      {change.confirmationQuestions.map(
                        (question) => (
                          <label
                            key={question.id}
                            style={{
                              display: "block",
                              marginTop: 12,
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            {question.prompt}

                            <textarea
                              value={
                                answers[
                                  change.id
                                ]?.[
                                  question.id
                                ] || ""
                              }
                              disabled={busy}
                              maxLength={500}
                              rows={3}
                              onChange={(event) =>
                                setAnswer(
                                  change.id,
                                  question.id,
                                  event.target
                                    .value
                                )
                              }
                              style={{
                                display:
                                  "block",
                                width: "100%",
                                marginTop: 6,
                                padding: 10,
                                color: "#f8fafc",
                                background:
                                  "#0b1220",
                                border:
                                  "1px solid #64748b",
                                borderRadius: 4,
                                resize:
                                  "vertical",
                                boxSizing:
                                  "border-box",
                              }}
                            />
                          </label>
                        )
                      )}

                      <button
                        type="button"
                        disabled={
                          activeRequest !== null
                        }
                        onClick={() =>
                          void handleConfirmation(
                            change
                          )
                        }
                        style={{
                          width: "100%",
                          marginTop: 12,
                          padding: "10px 12px",
                          background: busy
                            ? "#475569"
                            : "#f59e0b",
                          color: "#111827",
                          border: "none",
                          borderRadius: 4,
                          fontWeight: 700,
                          cursor:
                            activeRequest !== null
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {busy
                          ? "Reconstructing..."
                          : "Confirm details and reconstruct"}
                      </button>
                    </div>
                  )}

                  {change.userApprovalStatus ===
                    "pending" && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      {!needsConfirmation && (
                        <button
                          type="button"
                          disabled={
                            activeRequest !== null
                          }
                          onClick={() =>
                            void handleDecision(
                              change.id,
                              "approved"
                            )
                          }
                          style={{
                            flex: 1,
                            padding: "9px 12px",
                            background: busy
                              ? "#475569"
                              : "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor:
                              activeRequest !== null
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {busy
                            ? "Saving..."
                            : "Approve"}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          activeRequest !== null
                        }
                        onClick={() =>
                          void handleDecision(
                            change.id,
                            "rejected"
                          )
                        }
                        style={{
                          flex: 1,
                          padding: "9px 12px",
                          background: busy
                            ? "#475569"
                            : "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor:
                            activeRequest !== null
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {busy
                          ? "Saving..."
                          : needsConfirmation
                            ? "Reject this suggestion"
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
                </section>
              )
            })}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            disabled={activeRequest !== null}
            onClick={() =>
              router.push(
                "/career-activation/cv-intake"
              )
            }
            style={{
              padding: "12px 20px",
              background: "#334155",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor:
                activeRequest !== null
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Back to CV Intake
          </button>

          <button
            type="button"
            disabled={activeRequest !== null}
            onClick={() =>
              void handleContinue()
            }
            style={{
              flex: 1,
              minWidth: 240,
              padding: "12px 24px",
              background:
                activeRequest !== null
                  ? "#475569"
                  : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              cursor:
                activeRequest !== null
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {activeRequest === "continue"
              ? "Continuing..."
              : "Continue to Career Summary"}
          </button>
        </div>

        {status && (
          <div
            role="status"
            aria-live="polite"
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