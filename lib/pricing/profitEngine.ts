type JobLike = {
  pay_amount?: number | string | null;
  match_score?: number | string | null;
  quality_score?: number | string | null;
  profit_score?: number | string | null;
};

export function calculatePremiumPrice(job: JobLike) {
  let base = Number(job.pay_amount || 100);

  if (Number(job.match_score || 0) > 90) base *= 1.3;
  if (Number(job.quality_score || 0) > 80) base *= 1.2;
  if (Number(job.profit_score || 0) > 80) base *= 1.25;

  return Math.round(base);
}

export function addPremiumPositioning(text: string) {
  return `${text}

I focus on structured, reliable execution - not just quick fixes.

I focus on delivering high-quality, reliable outcomes rather than quick fixes.`;
}
