type JobLike = {
  pay_amount?: number | null;
  is_retainer?: boolean | null;
  match_score?: number | null;
  scam_risk?: string | null;
  [key: string]: unknown;
};

type UserLike = Record<string, unknown>;

type ForecastLike = {
  predicted_monthly?: number | null;
  [key: string]: unknown;
};

export function calculateProfitScore(job: JobLike): number {
  let score = 0;

  if ((job.pay_amount ?? 0) > 500) score += 40;
  else if ((job.pay_amount ?? 0) > 200) score += 20;

  if (job.is_retainer) score += 30;

  if ((job.match_score ?? 0) > 80) score += 20;

  if ((job.scam_risk || "").toLowerCase() === "low") score += 10;

  return score;
}

export function optimizeJobSelection<T extends JobLike>(jobs: T[]): Array<T & { profit_score: number }> {
  return jobs
    .map((job) => ({
      ...job,
      profit_score: calculateProfitScore(job),
    }))
    .sort((a, b) => b.profit_score - a.profit_score);
}

export function adjustStrategy(_user: UserLike, forecast: ForecastLike): { mode: "volume" | "balanced" | "premium" } {
  const predicted = Number(forecast?.predicted_monthly || 0);

  if (predicted < 1000) {
    return { mode: "volume" };
  }

  if (predicted < 5000) {
    return { mode: "balanced" };
  }

  return { mode: "premium" };
}
