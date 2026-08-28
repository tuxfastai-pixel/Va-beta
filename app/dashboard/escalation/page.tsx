"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EscalatedJob } from "@/lib/ai/escalationEngine";

interface EscalationData {
  jobs: EscalatedJob[];
  count: number;
  summary: {
    high: number;
    medium: number;
  };
}

export default function EscalationDashboard() {
  const [data, setData] = useState<EscalationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "high" | "medium">("all");

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        const response = await fetch("/api/escalation");
        if (!response.ok) throw new Error("Failed to fetch escalations");

        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEscalations();

    // Refresh every 5 minutes
    const interval = setInterval(fetchEscalations, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading escalations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">
          <p className="text-lg font-semibold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const jobs = data?.jobs || [];
  let filteredJobs = jobs;

  if (filter === "high") {
    filteredJobs = jobs.filter((j) => j.score >= 8);
  } else if (filter === "medium") {
    filteredJobs = jobs.filter((j) => j.score < 8);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            📊 Escalation Dashboard
          </h1>
          <p className="text-lg text-slate-600">
            High-value opportunities where YOU make the decision
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <p className="text-sm text-slate-600 mb-1">Total Opportunities</p>
            <p className="text-3xl font-bold text-slate-900">{data?.count || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <p className="text-sm text-slate-600 mb-1">High Value (≥8)</p>
            <p className="text-3xl font-bold text-slate-900">{data?.summary.high || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-sm text-slate-600 mb-1">Medium Value (7-8)</p>
            <p className="text-3xl font-bold text-slate-900">{data?.summary.medium || 0}</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "all"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            All ({jobs.length})
          </button>

          <button
            onClick={() => setFilter("high")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "high"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            High ({data?.summary.high || 0})
          </button>

          <button
            onClick={() => setFilter("medium")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "medium"
                ? "bg-yellow-500 text-white"
                : "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Medium ({data?.summary.medium || 0})
          </button>
        </div>

        {/* Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-lg text-slate-600">No opportunities to escalate right now.</p>
            <p className="text-sm text-slate-500 mt-2">
              Check back soon for new high-value opportunities!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6 border-l-4 border-blue-500"
              >
                {/* Score Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900">
                      {job.title}
                    </h3>
                    <p className="text-sm text-slate-500">{job.company || job.platform}</p>
                  </div>

                  <div
                    className={`text-2xl font-bold px-3 py-1 rounded-lg ${
                      job.score >= 8
                        ? "bg-orange-100 text-orange-900"
                        : "bg-yellow-100 text-yellow-900"
                    }`}
                  >
                    {job.score.toFixed(1)}
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-600 mb-4 line-clamp-2">
                  {job.description}
                </p>

                {/* Escalation Reasons */}
                {job.escalationReasons && job.escalationReasons.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">
                      Why Escalated:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {job.escalationReasons.map((reason) => (
                        <span
                          key={reason}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                        >
                          {reason.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Action */}
                {job.manualActionRequired && (
                  <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      👉 ACTION REQUIRED
                    </p>
                    <p className="text-sm text-blue-900">{job.manualActionRequired}</p>
                  </div>
                )}

                {/* Budget & Type */}
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  {job.budget && (
                    <div>
                      <p className="text-slate-500">Budget</p>
                      <p className="font-semibold text-slate-900">
                        ${job.budget.toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-slate-500">Type</p>
                    <p className="font-semibold text-slate-900">
                      {job.type || "Unknown"}
                    </p>
                  </div>
                </div>

                {/* Remote Badge */}
                {job.remote && (
                  <div className="mb-4 inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Remote
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {job.link && (
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-center"
                    >
                      📖 View Job
                    </a>
                  )}

                  <button className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-colors">
                    💾 Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
