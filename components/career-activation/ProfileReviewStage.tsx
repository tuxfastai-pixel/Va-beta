"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  curateSkillGroups,
  isMarketableSkill,
  isSkillCandidateCovered,
  normalizeCareerTerm,
  summarizeExperience,
} from "@/lib/career/profileCuration"

type SkillEvidence = {
  skill?: string
  evidence?: string
  sourceSection?: string
  evidenceType?: string
  confidence?: number
  requiresConfirmation?: boolean
}

type StructuredProfile = Record<string, unknown> & {
  fullName?: string
  professionalSummary?: string
  skills?: unknown
  skillEvidence?: SkillEvidence[]
  skillsNeedingConfirmation?: SkillEvidence[]
  workExperience?: unknown
  preferredRoles?: unknown
  followUpQuestions?: string[]
}

type ProfileReview = {
  structured_profile?: StructuredProfile
}

const panelStyle = {
  background: "#0b1220",
  padding: 16,
  borderRadius: 8,
  marginBottom: 16,
} as const

const actionButton = {
  border: "none",
  borderRadius: 6,
  padding: "8px 12px",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
} as const

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

export default function ProfileReviewStage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [busySkill, setBusySkill] = useState("")
  const [editedSkills, setEditedSkills] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState("")
  const [targetRoles, setTargetRoles] = useState("")

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/career/master-profile", { credentials: "include" })
        const payload = (await res.json().catch(() => ({}))) as {
          profile?: ProfileReview
          error?: string
        }
        if (!res.ok) {
          setStatus(payload.error || "Could not load profile")
          return
        }
        setProfile(payload.profile || null)
        const structured = payload.profile?.structured_profile
        setSummary(String(structured?.professionalSummary || ""))
        setTargetRoles(strings(structured?.preferredRoles).join(", "))
      } catch {
        setStatus("Could not load profile")
      } finally {
        setLoading(false)
      }
    }
    void loadProfile()
  }, [])

  const structured = profile?.structured_profile

  const skillGroups = useMemo(
    () => curateSkillGroups((structured || {}) as Record<string, unknown>, 30),
    [structured]
  )

  const pendingSkills = useMemo(() => {
    const allConfirmedSkills = strings(structured?.skills)
    const seen = new Set<string>()
    const values = Array.isArray(structured?.skillsNeedingConfirmation)
      ? structured.skillsNeedingConfirmation
      : []

    return values.filter((item) => {
      const skill = String(item.skill || "").trim()
      const key = normalizeCareerTerm(skill)
      if (
        !isMarketableSkill(skill) ||
        isSkillCandidateCovered(
          skill,
          item.evidence,
          allConfirmedSkills
        ) ||
        seen.has(key)
      ) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [structured?.skills, structured?.skillsNeedingConfirmation])

  const experience = useMemo(
    () => summarizeExperience((structured || {}) as Record<string, unknown>),
    [structured]
  )

  const updateProfile = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/career/master-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })
    const payload = (await res.json().catch(() => ({}))) as {
      profile?: ProfileReview
      error?: string
    }
    if (!res.ok || !payload.profile) {
      throw new Error(payload.error || "Could not update profile")
    }
    setProfile(payload.profile)
    return payload.profile
  }

  const handleSkillDecision = async (
    item: SkillEvidence,
    decision: "confirm" | "reject"
  ) => {
    const skill = String(item.skill || "").trim()
    if (!skill) return
    setBusySkill(skill)
    setStatus("")
    try {
      await updateProfile({
        action: "skill_decision",
        skill,
        decision,
        editedSkill: editedSkills[skill] || skill,
      })
      setStatus(decision === "confirm" ? `${skill} confirmed.` : `${skill} rejected.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save skill decision")
    } finally {
      setBusySkill("")
    }
  }

  const handleProfileDetails = async () => {
    setStatus("")
    try {
      const roles = targetRoles.split(/[,;\n]/).map((role) => role.trim()).filter(Boolean)
      await updateProfile({
        action: "profile_details",
        professionalSummary: summary,
        preferredRoles: roles,
      })
      setStatus("Career direction saved.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save career direction")
    }
  }

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

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Career DNA Review</h1>
        <p>Curate the evidence the system found before it rewrites or matches your CV.</p>

        {!profile ? (
          <div style={panelStyle}>No career profile was found. Return to CV Intake and upload your CV.</div>
        ) : (
          <>
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Profile overview</h2>
              <p><strong>Name:</strong> {structured?.fullName || "Not identified"}</p>
              {experience.roleCount !== null ? (
                <p><strong>Recognised experience records:</strong> {experience.roleCount}</p>
              ) : (
                <p>
                  <strong>Ungrouped experience evidence:</strong> {experience.evidenceCount} statements
                  <br />
                  <span style={{ color: "#fbbf24" }}>
                    Employer and role grouping still needs confirmation; the system will not call each statement a separate job.
                  </span>
                </p>
              )}
            </section>

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Prioritised confirmed skills</h2>
              <p style={{ color: "#94a3b8" }}>
                Evidence-backed skills are grouped by employer relevance. Headings and generic labels are excluded.
              </p>
              {skillGroups.length > 0 ? skillGroups.map((group) => (
                <div key={group.category} style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#93c5fd" }}>{group.category}</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {group.skills.map((skill) => (
                      <span
                        key={skill}
                        style={{
                          display: "inline-flex",
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "#172554",
                          border: "1px solid #3b82f6",
                          color: "#dbeafe",
                          fontSize: 14,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )) : <p>No confirmed professional skills were identified.</p>}
            </section>

            {pendingSkills.length > 0 ? (
              <section style={{ ...panelStyle, border: "1px solid #f59e0b", background: "#1c1917" }}>
                <h2 style={{ marginTop: 0, fontSize: 20, color: "#fbbf24" }}>Verify AI-normalized skills</h2>
                <p style={{ color: "#fde68a" }}>
                  Confirm the interpretation, edit it into accurate wording, or reject it. Nothing is promoted without your decision.
                </p>
                {pendingSkills.map((item) => {
                  const skill = String(item.skill || "")
                  const isBusy = busySkill === skill
                  return (
                    <article
                      key={normalizeCareerTerm(skill)}
                      style={{ borderTop: "1px solid #44403c", padding: "12px 0" }}
                    >
                      <label htmlFor={`skill-${normalizeCareerTerm(skill).replace(/\s+/g, "-")}`}>
                        <strong>{skill}</strong>
                      </label>
                      {item.evidence ? (
                        <p style={{ margin: "6px 0", color: "#cbd5e1" }}>
                          Evidence: {item.evidence}
                        </p>
                      ) : null}
                      <input
                        id={`skill-${normalizeCareerTerm(skill).replace(/\s+/g, "-")}`}
                        value={editedSkills[skill] ?? skill}
                        onChange={(event) =>
                          setEditedSkills((current) => ({ ...current, [skill]: event.target.value }))
                        }
                        maxLength={80}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: 10,
                          borderRadius: 6,
                          border: "1px solid #64748b",
                          background: "#0f172a",
                          color: "white",
                          margin: "6px 0 10px",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSkillDecision(item, "confirm")}
                          style={{ ...actionButton, background: "#059669" }}
                        >
                          {isBusy ? "Saving..." : "Confirm or save edit"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSkillDecision(item, "reject")}
                          style={{ ...actionButton, background: "#dc2626" }}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  )
                })}
              </section>
            ) : (
              <section style={{ ...panelStyle, border: "1px solid #059669" }}>
                <strong style={{ color: "#34d399" }}>All extracted skill candidates have been resolved.</strong>
              </section>
            )}

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Career direction</h2>
              <label htmlFor="professional-summary"><strong>Professional summary</strong></label>
              <textarea
                id="professional-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={5}
                maxLength={800}
                placeholder="Describe your demonstrated direction, strongest capabilities and the value you can provide."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  margin: "8px 0 14px",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #64748b",
                  background: "#0f172a",
                  color: "white",
                }}
              />
              <label htmlFor="target-roles"><strong>Target roles</strong></label>
              <input
                id="target-roles"
                value={targetRoles}
                onChange={(event) => setTargetRoles(event.target.value)}
                placeholder="e.g. AI Product Manager, Technical Support Lead"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  margin: "8px 0 12px",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #64748b",
                  background: "#0f172a",
                  color: "white",
                }}
              />
              <button
                type="button"
                onClick={() => void handleProfileDetails()}
                style={{ ...actionButton, background: "#2563eb" }}
              >
                Save career direction
              </button>
            </section>

            {Array.isArray(structured?.skillEvidence) && structured.skillEvidence.length > 0 ? (
              <details style={panelStyle}>
                <summary style={{ cursor: "pointer", color: "#93c5fd" }}>
                  Audit trail: view all supporting skill evidence
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
            ) : null}
          </>
        )}

        <button
          type="button"
          onClick={() => void handleContinue()}
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

        {status ? (
          <div role="status" aria-live="polite" style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 6 }}>
            {status}
          </div>
        ) : null}
      </div>
    </div>
  )
}
