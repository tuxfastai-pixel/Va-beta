"use client";
import { useEffect, useState } from "react";

type ApplicationItem = {
  id: string;
  job_title?: string | null;
  company?: string | null;
  status?: string | null;
  cover_letter?: string | null;
};

export default function ApplicationsDashboard() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);

  useEffect(() => {
    const loadApplications = async () => {
      const response = await fetch("/api/applications");
      const payload = (await response.json()) as ApplicationItem[] | { applications?: ApplicationItem[] };
      setApplications(Array.isArray(payload) ? payload : payload.applications || []);
    };

    void loadApplications();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">AI Suggested Applications</h1>

      {applications.map((app) => (
        <div key={app.id} className="border p-4 rounded mb-4">
          <h2>{app.job_title || "Untitled role"} @ {app.company || "Unknown company"}</h2>
          <p>Status: {app.status || "pending"}</p>
          <details>
            <summary>View Draft</summary>
            <pre>{app.cover_letter || "No draft available."}</pre>
          </details>
        </div>
      ))}
    </div>
  );
}
