"use client"

import { useState, useEffect } from "react"
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const res = await fetch("/api/career/recommended-jobs", { credentials: "include" })
        if (res.ok) {
          const { jobs: recommendedJobs } = await res.json()
          setJobs(recommendedJobs || [])
        }
      } catch (err) {
        setStatus("Could not load jobs")
      } finally {
        setLoading(false)
      }
    }
    loadJobs()
  }, [])

  const handleSelectJob = async (jobId: string) => {
    setSelectedJobId(jobId)
    const res = await fetch("/api/career/stage-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        toStage: "job-assessment",
        stageData: { selectedJobId: jobId }
      }),
    })
    if (res.ok) {
      router.push("/career-activation/job-assessment")
    } else {
      setStatus("Could not select job")
      setSelectedJobId(null)
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 24 }}>Loading recommended jobs...</div>
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 24, background: "#111827" }}>
        <h1 style={{ marginTop: 0 }}>Recommended Jobs</h1>
        <p>We&apos;ve found jobs that match your profile and career goals.</p>

        {jobs.length === 0 ? (
          <div style={{ background: "#0b1220", padding: 16, borderRadius: 6, marginBottom: 20 }}>
            <p>No jobs available yet. Check back soon or import your own in Phase 3.</p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  background: selectedJobId === job.id ? "#0f4c3a" : "#0b1220",
                  padding: 16,
                  borderRadius: 6,
                  marginBottom: 12,
                  border: selectedJobId === job.id ? "1px solid #10b981" : "1px solid #475569",
                  cursor: "pointer",
                }}
                onClick={() => handleSelectJob(job.id)}
              >
                <h3 style={{ margin: "0 0 8px 0" }}>{job.title}</h3>
                <p style={{ margin: "0 0 4px 0", color: "#cbd5e1" }}>{job.company} â€¢ {job.level}</p>
                <p style={{ margin: "8px 0 0 0", color: "#94a3b8", fontSize: 14 }}>
                  {job.description.substring(0, 150)}...
                </p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => router.push("/career-activation/job-assessment")}
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
          {selectedJobId ? "Assess Selected Job" : "Skip to Assessment"}
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
