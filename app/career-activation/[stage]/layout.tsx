"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { isValidStage } from "@/lib/career/activationContinuity.ts"

type JourneyState = {
  completedStages?: string[]
  currentStage?: string | null
}

export default function CareerActivationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const params = useParams()
  const stage = params.stage as string
  const [isLoading, setIsLoading] = useState(true)
  const [journeyState, setJourneyState] = useState<JourneyState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const validateAndLoad = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Validate stage
        if (!isValidStage(stage)) {
          setError("Invalid stage")
          router.push("/career-activation/complete")
          return
        }

        // Load journey state
        const response = await fetch("/api/career/journey-state", {
          method: "GET",
          credentials: "include",
        })

        if (!response.ok) {
          setError("Could not load journey state")
          return
        }

        const { state } = (await response.json()) as { state: JourneyState | null }
        setJourneyState(state)

        // Allow access if:
        // 1. Stage is in completed stages (user can review earlier stages)
        // 2. Stage is the current stage
        // 3. Prevent if: stage is beyond current stage (future prerequisite not met)
        if (state?.completedStages && Array.isArray(state.completedStages)) {
          const isCompleted = state.completedStages.includes(stage)
          const isCurrent = state.currentStage === stage

          if (!isCompleted && !isCurrent) {
            // User is trying to access a future stage they haven't reached
            setError("This stage is not yet available. Complete earlier stages first.")
            router.push(`/career-activation/${state.currentStage || "complete"}`)
            return
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    validateAndLoad()
  }, [stage, router])

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc" }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc" }}>
        <div style={{ maxWidth: 600, border: "1px solid #ef4444", borderRadius: 8, padding: 24, background: "#7f1d1d" }}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.push("/career-activation/complete")} style={{ marginTop: 16, padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Return to Career Activation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc" }}>
      <header style={{ borderBottom: "1px solid #1e293b", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h1 style={{ margin: 0 }}>Career Activation</h1>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {children}
      </main>
    </div>
  )
}
