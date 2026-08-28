"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type ProfileReview = {
  skills?: unknown
  workExperience?: unknown
}

export default function ProfileReviewStage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/career/master-profile", { credentials: "include" })
        if (res.ok) {
          const { profile } = await res.json()
          setProfile(profile)
        }
      } catch (err) {
        setStatus("Could not load profile")
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  const handleContinue = async () => {
    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toStage: "cv-improvements" }),
    })
    if (res.ok) {
      router.push("/career-activation/cv-improvements")
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading profile...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>AI Profile Review</h1>
        <p>Here&apos;s how the AI understands your career profile based on your CV.</p>

        {profile && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Core Profile</h3>
              <p><strong>Skills:</strong> {Array.isArray(profile.skills) ? profile.skills.join(", ") : "None identified"}</p>
              <p><strong>Work Experience:</strong> {Array.isArray(profile.workExperience) ? profile.workExperience.length : 0} entries</p>
            </div>
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
          Review AI Improvements
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
