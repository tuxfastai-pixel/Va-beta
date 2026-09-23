"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type IntakeMode = "upload" | "paste" | "build_from_onboarding" | "continue_without_cv"

export default function CareerActivationCompletePage() {
  const router = useRouter()
  const [mode, setMode] = useState<IntakeMode>("continue_without_cv")
  const [text, setText] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const submitIntake = async () => {
    setLoading(true)
    setStatus("Structuring career profile...")

    try {
      const intakeRes = await fetch("/api/career/cv-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode,
          text,
        }),
      })

      const intakePayload = (await intakeRes.json().catch(() => ({}))) as { error?: string }
      if (!intakeRes.ok) {
        setStatus(intakePayload.error || "Could not process CV intake.")
        return
      }

      const enhanceRes = await fetch("/api/career/cv-enhance", {
        method: "POST",
        credentials: "include",
      })

      const enhancePayload = (await enhanceRes.json().catch(() => ({}))) as { error?: string }
      if (!enhanceRes.ok) {
        setStatus(enhancePayload.error || "Could not generate CV improvement review.")
        return
      }

      setStatus("Career identity verified. Moving to recommended jobs...")
      router.push("/dashboard/jobs")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#0f172a", color: "#f8fafc" }}>
      <section style={{ maxWidth: 860, margin: "0 auto", border: "1px solid #334155", borderRadius: 14, padding: 20, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Career Activation Complete</h1>
        <p>Your core career profile has been created.</p>
        <p>Next, upload your CV/resume so the AI can organise and strengthen it.</p>

        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <label><input type="radio" name="mode" checked={mode === "upload"} onChange={() => setMode("upload")} /> Upload CV/resume</label>
          <label><input type="radio" name="mode" checked={mode === "paste"} onChange={() => setMode("paste")} /> Paste CV text</label>
          <label><input type="radio" name="mode" checked={mode === "build_from_onboarding"} onChange={() => setMode("build_from_onboarding")} /> Build CV from my onboarding answers</label>
          <label><input type="radio" name="mode" checked={mode === "continue_without_cv"} onChange={() => setMode("continue_without_cv")} /> Continue without CV for now</label>
        </div>

        {(mode === "paste" || mode === "upload") && (
          <div style={{ marginTop: 14 }}>
            <p style={{ marginBottom: 8 }}>For pilot mode, file upload is represented by text parsing support for PDF/DOCX/TXT extraction output.</p>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste CV text here"
              rows={10}
              style={{ width: "100%", borderRadius: 8, border: "1px solid #475569", background: "#0b1220", color: "#f8fafc", padding: 10 }}
            />
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => void submitIntake()}
            disabled={loading}
            style={{ border: "1px solid #22c55e", background: "#14532d", color: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}
          >
            {loading ? "Processing..." : "Continue"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            style={{ border: "1px solid #ef4444", background: "#7f1d1d", color: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}
          >
            Restart onboarding
          </button>
        </div>

        {status && <p style={{ marginTop: 12, color: "#93c5fd" }}>{status}</p>}
      </section>
    </main>
  )
}