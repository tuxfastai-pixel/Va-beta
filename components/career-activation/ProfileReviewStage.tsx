"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type SkillEvidence = {
  skill?: string
  evidence?: string
  sourceSection?: string
  evidenceType?: string
  confidence?: number
  requiresConfirmation?: boolean
}

type StructuredProfile = {
  fullName?: string
  professionalSummary?: string
  skills?: unknown
  skillEvidence?: SkillEvidence[]
  skillsNeedingConfirmation?: SkillEvidence[]
  skillExtractionMode?: string
  workExperience?: unknown
  missingFields?: string[]
  followUpQuestions?: string[]
}

type ProfileReview = {
  structured_profile?: StructuredProfile
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

function displayableSkill(value: unknown): string {
  const skill = String(value || "").replace(/\s+/g, " ").trim()
  if (
    !skill ||
    skill.length > 80 ||
    /[•\n]/.test(skill) ||
    /^(selected project experience|corporate governance|work experience|education|professional summary)$/i.test(skill)
  ) {
    return ""
  }
  return skill
}

const panelStyle = {
  background: "#0b1220",
  padding: 16,
  borderRadius: 8,
  marginBottom: 16,
} as const

const chipStyle = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#172554",
  border: "1px solid #3b82f6",
  color: "#dbeafe",
  fontSize: 14,
  lineHeight: 1.25,
} as const

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
        } else {
          setStatus("Could not load profile")
        }
      } catch {
        setStatus("Could not load profile")
      } finally {
        setLoading(false)
      }
    }
    void loadProfile()
  }, [])

  const structured = profile?.structured_profile

  const confirmedSkills = useMemo(() => {
    const values = Array.isArray(structured?.skills) ? structured.skills : []
    const seen = new Set<string>()
    return values
      .map(displayableSkill)
      .filter((skill) => {
        const key = normalize(skill)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [structured?.skills])

  const pendingSkills = useMemo(() => {
    const confirmed = new Set(confirmedSkills.map(normalize))
    const values = Array.isArray(structured?.skillsNeedingConfirmation)
      ? structured.skillsNeedingConfirmation
      : []
    const seen = new Set<string>()
    return values.filter((item) => {
      const skill = displayableSkill(item.skill)
      const key = normalize(skill)
      if (!key || confirmed.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [confirmedSkills, structured?.skillsNeedingConfirmation])

  const handleContinue = async () => {
    setStatus("")
    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toStage: "cv-improvements" }),
    })
    if (res.ok) {
      router.push("/career-activation/cv-improvements")
      return
    }
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    setStatus(payload.error || "Could not continue to CV improvements.")
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading profile...</div>
  }

  const workEvidenceCount = Array.isArray(structured?.workExperience)
    ? structured.workExperience.length
    : 0

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>AI Profile Review</h1>
        <p>Review what the system found before it proposes changes to your CV.</p>

        {!profile && (
          <div style={panelStyle}>No career profile was found. Return to CV Intake and upload your CV.</div>
        )}

        {profile && (
          <>
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Profile overview</h2>
              <p><strong>Name:</strong> {structured?.fullName || "Not identified"}</p>
              <p>
                <strong>Experience evidence captured:</strong> {workEvidenceCount}{" "}
                {workEvidenceCount === 1 ? "item" : "items"}
              </p>
              {structured?.professionalSummary && (
                <details>
                  <summary style={{ cursor: "pointer", color: "#93c5fd" }}>View current professional summary</summary>
                  <p style={{ lineHeight: 1.6 }}>{structured.professionalSummary}</p>
                </details>
              )}
            </section>

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Confirmed CV skills</h2>
              <p style={{ color: "#94a3b8" }}>
                These are directly stated in your CV. They can be used as evidence without adding new claims.
              </p>
              {confirmedSkills.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {confirmedSkills.map((skill) => (
                    <span key={skill} style={chipStyle}>{skill}</span>
                  ))}
                </div>
              ) : (
                <p>No directly stated skills were identified.</p>
              )}
              {confirmedSkills.length > 16 && (
                <p style={{ marginBottom: 0, color: "#94a3b8" }}>
                  {confirmedSkills.length} confirmed skills were captured.
                </p>
              )}
            </section>

            {pendingSkills.length > 0 && (
              <section style={{ ...panelStyle, border: "1px solid #f59e0b", background: "#1c1917" }}>
                <h2 style={{ marginTop: 0, fontSize: 20, color: "#fbbf24" }}>
                  AI-normalized skills to verify
                </h2>
                <p style={{ color: "#fde68a" }}>
                  These are possible professional interpretations of your evidence. They are not treated as confirmed facts until you verify them during the improvement review.
                </p>
                <ul style={{ paddingLeft: 22 }}>
                  {pendingSkills.slice(0, 8).map((item) => (
                    <li key={normalize(String(item.skill))} style={{ marginBottom: 8 }}>
                      <strong>{item.skill}</strong>
                      {item.evidence ? <span style={{ color: "#cbd5e1" }}> — {item.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
                {pendingSkills.length > 8 && (
                  <details>
                    <summary style={{ cursor: "pointer", color: "#fbbf24" }}>
                      View {pendingSkills.length - 8} more candidates
                    </summary>
                    <ul style={{ paddingLeft: 22 }}>
                      {pendingSkills.slice(8).map((item) => (
                        <li key={normalize(String(item.skill))} style={{ marginBottom: 8 }}>
                          <strong>{item.skill}</strong>
                          {item.evidence ? <span style={{ color: "#cbd5e1" }}> — {item.evidence}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}

            {Array.isArray(structured?.skillEvidence) && structured.skillEvidence.length > 0 && (
              <details style={panelStyle}>
                <summary style={{ cursor: "pointer", color: "#93c5fd" }}>
                  Audit trail: view supporting skill evidence
                </summary>
                <ul style={{ paddingLeft: 22 }}>
                  {structured.skillEvidence.map((item, index) => (
                    <li key={`${item.skill || "skill"}-${index}`} style={{ marginBottom: 8 }}>
                      <strong>{item.skill || "Unnamed skill"}</strong>
                      {item.evidence ? `: ${item.evidence}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {Array.isArray(structured?.followUpQuestions) && structured.followUpQuestions.length > 0 && (
              <section style={panelStyle}>
                <h2 style={{ marginTop: 0, fontSize: 20 }}>Information still needed</h2>
                <ul>
                  {structured.followUpQuestions.map((question) => <li key={question}>{question}</li>)}
                </ul>
              </section>
            )}
          </>
        )}

        <button
          onClick={handleContinue}
          disabled={!profile}
          style={{
            padding: "12px 24px",
            background: profile ? "#3b82f6" : "#475569",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: profile ? "pointer" : "not-allowed",
            width: "100%",
          }}
        >
          Review Evidence-Based Improvements
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
