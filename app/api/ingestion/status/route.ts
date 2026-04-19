import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type JobQualityRow = {
  quality_score: number | null;
  scam_risk: string | number | null;
  quality_reason: string | null;
  created_at: string | null;
  title: string | null;
  company: string | null;
  description: string | null;
};

function toReason(row: JobQualityRow) {
  const explicit = String(row.quality_reason || "").trim();
  if (explicit) {
    return explicit;
  }

  const numericRisk = Number(row.scam_risk ?? 0);
  if (Number.isFinite(numericRisk) && numericRisk >= 0.6) {
    return "scam_risk";
  }

  if (String(row.scam_risk || "").toLowerCase() === "high") {
    return "scam_risk";
  }

  if ((row.quality_score ?? 0) <= 70) {
    return "low_quality";
  }

  return "unknown";
}

function inferSource(row: JobQualityRow) {
  const company = String(row.company || "").toLowerCase();
  const description = String(row.description || "").toLowerCase();
  if (company.includes("upwork") || description.includes("upwork")) {
    return "upwork";
  }

  if (company.includes("indeed") || description.includes("indeed")) {
    return "indeed";
  }

  if (company.includes("remoteok") || description.includes("remoteok")) {
    return "remoteok";
  }

  return "unknown";
}

function topKeys(counts: Record<string, number>, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export async function GET() {
  const { data, error } = await supabase
    .from("jobs")
    .select("quality_score, scam_risk, quality_reason, created_at, title, company, description");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as JobQualityRow[];

  const accepted = rows.filter((j) => (j.quality_score ?? 0) > 70);
  const rejected = rows.filter((j) => (j.quality_score ?? 0) <= 70);

  const reasonCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};

  for (const row of rejected) {
    const reason = toReason(row);
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }

  for (const row of rows) {
    const source = inferSource(row);
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  }

  const sortedRuns = rows
    .map((row) => row.created_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => (a > b ? -1 : 1));

  const jobsCrawled = rows.length;
  const jobsAccepted = accepted.length;
  const jobsRejected = rejected.length;
  const acceptanceRate = jobsCrawled === 0 ? 0 : Number((jobsAccepted / jobsCrawled).toFixed(3));

  return NextResponse.json({
    last_run: sortedRuns[0] || null,
    jobs_crawled: jobsCrawled,
    accepted_jobs: jobsAccepted,
    rejected_jobs: jobsRejected,
    acceptance_rate: acceptanceRate,
    jobs_accepted: jobsAccepted,
    jobs_rejected: jobsRejected,
    top_rejection_reasons: topKeys(reasonCounts),
    sources: sourceCounts,
    top_sources: topKeys(sourceCounts),
  });
}
