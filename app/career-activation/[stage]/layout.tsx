"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  isValidStage,
} from "@/lib/career/activationContinuity.ts"

type JourneyState = {
  completedStages?: string[]
  currentStage?: string | null
}

const stages = [
  { id: "complete", label: "Start" },
  { id: "cv-intake", label: "CV Intake" },
  { id: "profile-review", label: "Profile Review" },
  { id: "cv-improvements", label: "CV Improvements" },
  { id: "career-summary", label: "Career Summary" },
  { id: "job-discovery", label: "Jobs" },
  { id: "job-assessment", label: "Assessment" },
  { id: "application-pack", label: "Application Pack" },
  { id: "interview-prep", label: "Interview Prep" },
] as const

export default function CareerActivationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const params = useParams()
  const stage = params.stage as string

  const [isLoading, setIsLoading] =
    useState(true)

  const [journeyState, setJourneyState] =
    useState<JourneyState | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    const validateAndLoad = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (!isValidStage(stage)) {
          setError("Invalid stage")
          return
        }

        const response = await fetch(
          "/api/career/journey-state",
          {
            method: "GET",
            credentials: "include",
          }
        )

        if (!response.ok) {
          setError("Could not load journey state")
          return
        }

        const result = (
          await response.json()
        ) as {
          state: JourneyState | null
        }

        const state = result.state
        setJourneyState(state)

        if (
          state?.completedStages &&
          Array.isArray(state.completedStages)
        ) {
          const isCompleted =
            state.completedStages.includes(stage)

          const isCurrent =
            state.currentStage === stage

          if (!isCompleted && !isCurrent) {
            setError(
              "This stage is not yet available. Complete earlier stages first."
            )
            return
          }
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "An error occurred"
        )
      } finally {
        setIsLoading(false)
      }
    }

    void validateAndLoad()
  }, [stage])

  const currentIndex = useMemo(
    () =>
      stages.findIndex(
        (item) => item.id === stage
      ),
    [stage]
  )

  const furthestAvailableIndex = useMemo(() => {
    const reached = new Set([
      ...(journeyState?.completedStages || []),
      journeyState?.currentStage || "",
    ])

    return stages.reduce(
      (furthest, item, index) =>
        reached.has(item.id)
          ? Math.max(furthest, index)
          : furthest,
      0
    )
  }, [journeyState])

  const previousStage =
    currentIndex > 0
      ? stages[currentIndex - 1]
      : null

  const openStage = (target: string) => {
    router.push(
      target === "complete"
        ? "/career-activation/complete"
        : `/career-activation/${target}`
    )
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
        }}
      >
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <h1 style={{ margin: 0 }}>
              Career Activation
            </h1>

            <div
              style={{
                display: "flex",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  router.push("/dashboard")
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #64748b",
                  background: "#1e293b",
                  color: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                Home
              </button>

              <button
                type="button"
                disabled={!previousStage}
                onClick={() => {
                  if (previousStage) {
                    openStage(previousStage.id)
                  }
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #64748b",
                  background: previousStage
                    ? "#334155"
                    : "#1e293b",
                  color: previousStage
                    ? "#f8fafc"
                    : "#64748b",
                  cursor: previousStage
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                Previous
              </button>
            </div>
          </div>

          <nav
            aria-label="Career Activation stages"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 16,
            }}
          >
            {stages.map((item, index) => {
              const isActive =
                item.id === stage

              const isAvailable =
                index <= furthestAvailableIndex

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!isAvailable}
                  aria-current={
                    isActive ? "step" : undefined
                  }
                  onClick={() =>
                    openStage(item.id)
                  }
                  style={{
                    padding: "7px 10px",
                    borderRadius: 999,
                    border: isActive
                      ? "2px solid #60a5fa"
                      : "1px solid #475569",
                    background: isActive
                      ? "#1d4ed8"
                      : isAvailable
                        ? "#1e293b"
                        : "#0f172a",
                    color: isAvailable
                      ? "#f8fafc"
                      : "#64748b",
                    cursor: isAvailable
                      ? "pointer"
                      : "not-allowed",
                    fontSize: 13,
                  }}
                >
                  {index + 1}. {item.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px",
        }}
      >
        {error ? (
          <div
            style={{
              maxWidth: 600,
              margin: "40px auto",
              border: "1px solid #ef4444",
              borderRadius: 8,
              padding: 24,
              background: "#7f1d1d",
            }}
          >
            <h2>Error</h2>
            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                router.push("/dashboard")
              }
              style={{
                marginRight: 8,
                padding: "8px 16px",
                background: "#334155",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Home
            </button>

            <button
              type="button"
              onClick={() =>
                openStage(
                  journeyState?.currentStage ||
                    "complete"
                )
              }
              style={{
                padding: "8px 16px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Return to current stage
            </button>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}