"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type IntakeMode = "upload" | "paste" | "build_from_onboarding" | "continue_without_cv"

export default function CvIntakeStage() {
  const router = useRouter()
  const [mode, setMode] = useState<IntakeMode>("paste")
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")

  const handleSubmit = async () => {
    setLoading(true)
    setStatus("Processing your CV...")

    try {
      const intakeRes = await fetch("/api/career/cv-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode, text }),
      })

      if (!intakeRes.ok) {
        const payload = (await intakeRes.json().catch(() => ({}))) as { error?: string }
        setStatus(payload.error || "Could not process CV.")
        return
      }

      setStatus("Analyzing your profile...")

      const enhanceRes = await fetch("/api/career/cv-enhance", {
        method: "POST",
        credentials: "include",
      })

      if (!enhanceRes.ok) {
        const payload = (await enhanceRes.json().catch(() => ({}))) as { error?: string }
        setStatus(payload.error || "Could not analyze CV.")
        return
      }

      // Transition to next stage
      const transitionRes = await fetch("/api/career/stage-transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toStage: "profile-review" }),
      })

      if (transitionRes.ok) {
        router.push("/career-activation/profile-review")
      } else {
        setStatus("Proceeding to profile review...")
        setTimeout(() => router.push("/career-activation/profile-review"), 1000)
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Upload or Build Your CV</h1>
        <p>Provide your CV or resume so the AI can organize and strengthen it for your target roles.</p>

        <div style={{ display: "grid", gap: 12, marginTop: 20, marginBottom: 20 }}>
          {(["paste", "upload", "build_from_onboarding", "continue_without_cv"] as IntakeMode[]).map((m) => (
            <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="mode"
                checked={mode === m}
                onChange={() => setMode(m)}
                style={{ cursor: "pointer" }}
              />
              <span>
                {m === "paste" && "Paste CV text"}
                {m === "upload" && "Upload CV (PDF/DOCX/TXT)"}
                {m === "build_from_onboarding" && "Build from my onboarding answers"}
                {m === "continue_without_cv" && "Continue without CV for now"}
              </span>
            </label>
          ))}
        </div>

        {(mode === "paste" || mode === "upload") && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ fontWeight: "600" }}>Paste your CV text:</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your CV or resume text here..."
              rows={12}
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #475569",
                background: "#0b1220",
                color: "#f8fafc",
                padding: 12,
                fontFamily: "monospace",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              For pilot mode, file uploads are processed by converting to text. PDF/DOCX extraction will be available in Phase 2.
            </p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || (mode === "paste" && !text.trim())}
          style={{
            padding: "12px 24px",
            background: loading ? "#475569" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            width: "100%",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Processing..." : "Continue"}
        </button>

        {status && (
          <div style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 6, fontSize: 14 }}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
