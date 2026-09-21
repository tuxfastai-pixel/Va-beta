"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Job = {
  id: string
  title: string
  company: string
  description: string
  level: string
}

export default function JobDiscoveryStage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [company, setCompany] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/career/recommended-jobs", { credentials: "include" })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStatus(payload.error || "Could not load recommended jobs.")
        } else {
          setJobs(payload.jobs || [])
        }
      } catch {
        setStatus("Could not load recommended jobs.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const assess = async (input: { jobId?: string; title?: string; company?: string; description?: string }) => {
    setSubmitting(true)
    setStatus("Analysing this role against your confirmed profile...")

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
    return <div style={{ textAlign: "center", padding: 24 }}>Loading job options...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Choose a Job to Assess</h1>
        <p>A match score needs a real job description. Select a saved role or paste one below.</p>

        {jobs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20 }}>Recommended Jobs</h2>
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                disabled={submitting}
                onClick={() => void assess({ jobId: job.id })}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "#0b1220",
                  color: "white",
                  padding: 16,
                  borderRadius: 6,
                  marginBottom: 12,
                  border: "1px solid #475569",
                  cursor: submitting ? "wait" : "pointer",
                }}
              >
                <strong>{job.title}</strong>
                <span style={{ display: "block", marginTop: 6, color: "#cbd5e1" }}>
                  {job.company} · {job.level}
                </span>
                <span style={{ display: "block", marginTop: 8, color: "#94a3b8", fontSize: 14 }}>
                  {job.description.slice(0, 180)}{job.description.length > 180 ? "…" : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ background: "#0b1220", padding: 18, borderRadius: 8, border: "1px solid #475569" }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>
            {jobs.length === 0 ? "Paste a Job You Want" : "Assess Another Job"}
          </h2>
          <p style={{ color: "#cbd5e1" }}>
            Copy the title and full requirements from a job advert. The system will compare them with your confirmed CV evidence.
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
        </div>

        {status && <div role="status" style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 6 }}>{status}</div>}
      </div>
    </div>
  )
}
