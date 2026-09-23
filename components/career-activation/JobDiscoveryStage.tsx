"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Job = {
  id: string
  title: string
  company: string
  description: string
  level: string
  matchScore: number | null
  recommended?: boolean
  source?: string | null
  location?: string | null
  salary?: string | null
  applyUrl?: string | null
  qualityScore?: number
}

type SearchSummary = {
  discovered: number
  accepted: number
  recommended: number
  sources: string[]
  searchedAt: string
}

export default function JobDiscoveryStage() {
  const router = useRouter()
  const searchedEmptyFeed = useRef(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchSummary, setSearchSummary] = useState<SearchSummary | null>(null)
  const [title, setTitle] = useState("")
  const [company, setCompany] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("")

  const loadJobs = async () => {
    const res = await fetch("/api/career/recommended-jobs", {
      credentials: "include",
      cache: "no-store",
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload.error || "Could not load jobs.")
    const loaded = Array.isArray(payload.jobs) ? payload.jobs : []
    setJobs(loaded)
    return loaded
  }

  const searchForJobs = async (automatic = false) => {
    setSearching(true)
    setStatus(
      automatic
        ? "Your Opportunity Hunter is checking approved job feeds..."
        : "Searching approved job feeds against your Career DNA..."
    )

    try {
      const res = await fetch("/api/career/recommended-jobs", {
        method: "POST",
        credentials: "include",
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Job search could not be completed.")

      setSearchSummary(payload)
      const refreshed = await loadJobs()
      setStatus(
        refreshed.length > 0
          ? `Opportunity Hunter found ${refreshed.length} suitable role${refreshed.length === 1 ? "" : "s"}. Review each match before continuing.`
          : "No safe matches were found in this search. You can refresh later or paste a job below."
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Approved job feeds are temporarily unavailable."
      )
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await loadJobs()
        if (loaded.length === 0 && !searchedEmptyFeed.current) {
          searchedEmptyFeed.current = true
          await searchForJobs(true)
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not load job opportunities.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const assess = async (input: {
    jobId?: string
    title?: string
    company?: string
    description?: string
  }) => {
    setSubmitting(true)
    setStatus("Analysing this role against your confirmed Career DNA...")

    try {
      const assessmentRes = await fetch("/api/career/job-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      })
      const payload = await assessmentRes.json().catch(() => ({}))

      if (!assessmentRes.ok) {
        setStatus(payload.error || "Could not assess this job.")
        return
      }

      const transitionRes = await fetch("/api/career/stage-transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toStage: "job-assessment",
          stageData: {
            selectedJobId: input.jobId || null,
            assessmentId: payload.assessmentId,
            jobTitle: payload.jobTitle,
          },
        }),
      })

      if (!transitionRes.ok) {
        const transitionPayload = await transitionRes.json().catch(() => ({}))
        setStatus(transitionPayload.error || "Assessment was saved, but the next page could not be opened.")
        return
      }

      router.push("/career-activation/job-assessment")
    } catch {
      setStatus("Could not assess this job. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading your Opportunity Hunter...</div>
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>Jobs Found for You</h1>
            <p style={{ marginBottom: 8 }}>
              Opportunity Hunter searches approved public feeds and ranks roles against your verified Career DNA.
            </p>
            <p style={{ marginTop: 0, color: "#94a3b8", fontSize: 14 }}>
              It never submits an application without your review and approval.
            </p>
          </div>
          <button
            type="button"
            disabled={searching || submitting}
            onClick={() => void searchForJobs(false)}
            style={{ padding: "10px 16px", background: "#0f766e", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: searching ? "wait" : "pointer", opacity: searching ? 0.65 : 1 }}
          >
            {searching ? "Searching..." : "Find Fresh Jobs"}
          </button>
        </div>

        {searchSummary && (
          <div style={{ background: "#0b1220", padding: 12, borderRadius: 6, margin: "14px 0", color: "#cbd5e1", fontSize: 14 }}>
            Checked {searchSummary.discovered} listings from {searchSummary.sources.join(" and ")} ·
            {" "}{searchSummary.accepted} passed safety and relevance filters ·
            {" "}{searchSummary.recommended} scored 75% or higher
          </div>
        )}

        {jobs.length > 0 ? (
          <div style={{ margin: "20px 0 26px" }}>
            {jobs.map((job) => (
              <article
                key={job.id}
                style={{ background: "#0b1220", padding: 16, borderRadius: 8, marginBottom: 14, border: job.recommended ? "1px solid #10b981" : "1px solid #475569" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>{job.title}</h2>
                    <p style={{ margin: 0, color: "#cbd5e1" }}>
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ color: job.recommended ? "#34d399" : "#93c5fd" }}>{job.level}</strong>
                    {job.recommended && <div style={{ color: "#34d399", fontSize: 13 }}>Recommended to review</div>}
                  </div>
                </div>

                <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.5 }}>
                  {job.description.slice(0, 320)}{job.description.length > 320 ? "…" : ""}
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={submitting || searching}
                    onClick={() => void assess({ jobId: job.id })}
                    style={{ padding: "10px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: submitting ? "wait" : "pointer" }}
                  >
                    Review Match
                  </button>
                  {job.applyUrl && (
                    <a href={job.applyUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", padding: "9px 4px" }}>
                      View original on {job.source || "source"}
                    </a>
                  )}
                  {job.salary && <span style={{ color: "#cbd5e1", fontSize: 14 }}>{job.salary}</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, margin: "18px 0" }}>
            <p style={{ margin: 0 }}>
              {searching
                ? "Opportunity Hunter is searching now..."
                : "No suitable roles are stored yet. Select Find Fresh Jobs or use the manual fallback below."}
            </p>
          </div>
        )}

        <details style={{ background: "#0b1220", padding: 18, borderRadius: 8, border: "1px solid #475569" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 18 }}>
            Manual fallback: paste a job
          </summary>
          <p style={{ color: "#cbd5e1" }}>
            Use this only when you found a vacancy that Opportunity Hunter did not import.
          </p>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Job title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. IT Support Technician" style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #64748b", background: "#111827", color: "white" }} />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Company (optional)</span>
            <input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #64748b", background: "#111827", color: "white" }} />
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Job description and requirements</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={9} placeholder="Paste the responsibilities, required skills and qualifications..." style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #64748b", background: "#111827", color: "white", resize: "vertical" }} />
          </label>

          <button
            type="button"
            disabled={submitting || !title.trim() || description.trim().length < 40}
            onClick={() => void assess({ title, company, description })}
            style={{ padding: "12px 24px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: submitting ? "wait" : "pointer", width: "100%", opacity: submitting || !title.trim() || description.trim().length < 40 ? 0.55 : 1 }}
          >
            {submitting ? "Assessing Job..." : "Assess This Job"}
          </button>
        </details>

        {status && <div role="status" style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 6 }}>{status}</div>}
      </div>
    </div>
  )
}
