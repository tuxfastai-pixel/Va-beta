"use client";
import { useEffect, useState } from "react";

type ActiveJob = {
  id: string;
  job_title?: string | null;
  company?: string | null;
  pay_amount?: number | string | null;
};

export default function ActiveJobs() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);

  useEffect(() => {
    const loadJobs = async () => {
      const response = await fetch("/api/active-jobs");
      const payload = (await response.json()) as ActiveJob[] | { jobs?: ActiveJob[] };
      setJobs(Array.isArray(payload) ? payload : payload.jobs || []);
    };

    void loadJobs();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Active AI Managed Jobs</h1>

      {jobs.map((job) => (
        <div key={job.id} className="border p-4 mb-4">
          <h2>{job.job_title || "Untitled job"}</h2>
          <p>{job.company || "Unknown company"}</p>
          <p>Pay: {job.pay_amount ?? "N/A"}</p>
        </div>
      ))}
    </div>
  );
}
