import { supabaseServer } from "@/lib/supabaseServer";

type JobMatch = {
  id: string;
  pay_amount?: number | string | null;
  match_score?: number | string | null;
  scam_risk?: string | null;
  profit_score?: number | null;
};

export function calculateProfitScore(job: JobMatch) {
  const pay = Number(job.pay_amount || 0);
  const match = Number(job.match_score || 0);
  const risk = job.scam_risk === "low" ? 1 : 0.5;

  return Math.round((pay * 0.4 + match * 0.4) * risk);
}

export async function updateJobProfitScores() {
  const { data: jobs, error } = await supabaseServer
    .from("job_matches")
    .select("id, pay_amount, match_score, scam_risk");

  if (error) {
    throw new Error(`Failed to load job matches: ${error.message}`);
  }

  const updated: Array<{ id: string; profit_score: number }> = [];

  for (const job of jobs || []) {
    const score = calculateProfitScore(job);

    const { error: updateError } = await supabaseServer
      .from("job_matches")
      .update({ profit_score: score })
      .eq("id", job.id);

    if (updateError) {
      throw new Error(`Failed to update profit_score for ${job.id}: ${updateError.message}`);
    }

    updated.push({ id: String(job.id), profit_score: score });
  }

  return updated;
}

export async function getBestJobs(limit: number = 10) {
  const { data, error } = await supabaseServer
    .from("job_matches")
    .select("*")
    .order("profit_score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load prioritized jobs: ${error.message}`);
  }

  return data || [];
}
