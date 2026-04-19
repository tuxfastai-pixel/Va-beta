"use client";

import { useEffect, useState } from "react";

type JobItem = {
  id: string;
  title?: string | null;
  company?: string | null;
  match_score?: number | null;
  quality_score?: number | null;
  scam_risk?: string | number | null;
  decision?: string | null;
  quality_reason?: string | null;
};

export default function JobsDashboard() {
  const [jobs, setJobs] = useState<JobItem[]>([]);

  useEffect(() => {
    const loadJobs = async () => {
      const response = await fetch("/api/jobs");
      const payload = (await response.json()) as JobItem[] | { jobs?: JobItem[] };
      setJobs(Array.isArray(payload) ? payload : payload.jobs || []);
    };

    void loadJobs();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">AI Matched Opportunities</h1>

      {jobs.map((job) => (
        <div
          key={job.id}
          className="border p-4 rounded mb-4"
        >
          <h2 className="font-semibold">{job.title || "Untitled opportunity"}</h2>

          <p>{job.company || "Unknown company"}</p>

          <p>Match Score: {job.match_score ?? 0}%</p>
          <p>Quality Score: {job.quality_score ?? "N/A"}</p>
          <p>Scam Risk: {String(job.scam_risk || "unknown").replace(/^./, (c: string) => c.toUpperCase())}</p>
          <p>Decision: {job.decision || "Pending"}</p>
          <p>Reason: {job.quality_reason || "No reason available"}</p>
        </div>
      ))}
    </div>
  );
}
