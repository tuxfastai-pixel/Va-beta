"use client"

import { useRouter } from "next/navigation"
import { getNextStage } from "@/lib/career/activationContinuity.ts"

export default function CompleteStage() {
  const router = useRouter()

  const handleContinue = () => {
    router.push("/career-activation/cv-intake")
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>🎉 Career Activation Complete</h1>
        <p style={{ fontSize: 16, lineHeight: 1.6 }}>
          Your core career profile has been created and verified.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
          Next, upload your CV or resume so the AI can organize and strengthen it for your target roles.
        </p>

        <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 24, borderLeft: "4px solid #3b82f6" }}>
          <p style={{ marginTop: 0, fontWeight: "600" }}>What happens next:</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Upload or build your CV</li>
            <li>AI reviews and organizes your experience</li>
            <li>You approve changes before using the CV</li>
            <li>Find and assess job opportunities</li>
            <li>Prepare tailored applications</li>
          </ul>
        </div>

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
          Continue to CV Upload
        </button>
      </div>
    </div>
  )
}
