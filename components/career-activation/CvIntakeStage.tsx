"use client"

import { ChangeEvent, DragEvent, useState } from "react"
import { useRouter } from "next/navigation"

type IntakeMode =
  | "upload"
  | "paste"
  | "build_from_onboarding"
  | "continue_without_cv"

type ExtractPayload = {
  error?: string
  fileName?: string
  text?: string
}

export default function CvIntakeStage() {
  const router = useRouter()
  const [mode, setMode] = useState<IntakeMode>("paste")
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")

  const extractFile = async (file: File) => {
    setExtracting(true)
    setStatus(`Reading ${file.name}...`)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/career/cv-extract", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const payload =
        (await response.json().catch(() => ({}))) as ExtractPayload

      if (!response.ok || !payload.text) {
        setText("")
        setFileName("")
        setStatus(
          payload.error ||
            "The selected document could not be read."
        )
        return
      }

      setText(payload.text)
      setFileName(payload.fileName || file.name)
      setStatus(
        `${payload.fileName || file.name} is ready for review.`
      )
    } catch (error) {
      setText("")
      setFileName("")
      setStatus(
        error instanceof Error
          ? error.message
          : "The selected document could not be read."
      )
    } finally {
      setExtracting(false)
    }
  }

  const handleFileInput = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      void extractFile(file)
    }
  }

  const handleDrop = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    setDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (file) {
      void extractFile(file)
    }
  }

  const handleSubmit = async () => {
    if (
      (mode === "paste" || mode === "upload") &&
      !text.trim()
    ) {
      setStatus(
        mode === "upload"
          ? "Select and extract a DOCX or TXT file first."
          : "Paste your CV text first."
      )
      return
    }

    setLoading(true)
    setStatus("Processing your CV...")

    try {
      const intakeRes = await fetch("/api/career/cv-intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          mode,
          text,
          fileName: fileName || null,
        }),
      })

      if (!intakeRes.ok) {
        const payload =
          (await intakeRes.json().catch(() => ({}))) as {
            error?: string
          }

        setStatus(
          payload.error || "Could not process CV."
        )
        return
      }

      setStatus("Analyzing your profile...")

      const enhanceRes = await fetch(
        "/api/career/cv-enhance",
        {
          method: "POST",
          credentials: "include",
        }
      )

      if (!enhanceRes.ok) {
        const payload =
          (await enhanceRes.json().catch(() => ({}))) as {
            error?: string
          }

        setStatus(
          payload.error || "Could not analyze CV."
        )
        return
      }

      const transitionRes = await fetch(
        "/api/career/stage-transition",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            toStage: "profile-review",
          }),
        }
      )

      if (!transitionRes.ok) {
        const payload =
          (await transitionRes.json().catch(() => ({}))) as {
            error?: string
          }

        setStatus(
          payload.error ||
            "Could not continue to profile review."
        )
        return
      }

      router.push("/career-activation/profile-review")
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unexpected error"
      )
    } finally {
      setLoading(false)
    }
  }

  const busy =
    loading || extracting

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid #334155",
          borderRadius: 8,
          padding: 24,
          background: "#111827",
        }}
      >
        <h1 style={{ marginTop: 0 }}>
          Upload or Build Your CV
        </h1>
        <p>
          Provide your CV so the system can organize
          evidence and identify information that still
          needs your confirmation.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          {(
            [
              "paste",
              "upload",
              "build_from_onboarding",
              "continue_without_cv",
            ] as IntakeMode[]
          ).map((item) => (
            <label
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === item}
                onChange={() => {
                  setMode(item)
                  setStatus("")
                }}
              />
              <span>
                {item === "paste" && "Paste CV text"}
                {item === "upload" &&
                  "Upload CV (DOCX/TXT)"}
                {item === "build_from_onboarding" &&
                  "Build from my onboarding answers"}
                {item === "continue_without_cv" &&
                  "Continue without CV for now"}
              </span>
            </label>
          ))}
        </div>

        {mode === "upload" && (
          <div style={{ marginBottom: 20 }}>
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              style={{
                padding: 24,
                borderRadius: 8,
                border: dragActive
                  ? "2px solid #60a5fa"
                  : "2px dashed #475569",
                background: "#0b1220",
                textAlign: "center",
              }}
            >
              <p>
                Drag a DOCX or TXT file here, or choose
                one from your computer.
              </p>
              <label
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  background: "#2563eb",
                  color: "white",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Browse files
                <input
                  type="file"
                  accept=".docx,.txt"
                  onChange={handleFileInput}
                  disabled={busy}
                  style={{ display: "none" }}
                />
              </label>
              <p
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                }}
              >
                Maximum 5 MB. PDF extraction is not
                enabled in this release.
              </p>
              {fileName && (
                <p>
                  <strong>Selected:</strong> {fileName}
                </p>
              )}
            </div>

            {text && (
              <details style={{ marginTop: 12 }}>
                <summary>
                  Review extracted CV text
                </summary>
                <textarea
                  value={text}
                  onChange={(event) =>
                    setText(event.target.value)
                  }
                  rows={12}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    borderRadius: 6,
                    border: "1px solid #475569",
                    background: "#0b1220",
                    color: "#f8fafc",
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                />
              </details>
            )}
          </div>
        )}

        {mode === "paste" && (
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Paste your CV text
            </label>
            <textarea
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
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
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          style={{
            padding: "12px 24px",
            background: busy ? "#475569" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            width: "100%",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {extracting
            ? "Reading document..."
            : loading
              ? "Processing..."
              : "Continue"}
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