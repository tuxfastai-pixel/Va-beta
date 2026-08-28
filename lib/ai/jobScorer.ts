import { getPlatformWeight } from "@/lib/platforms/platformRegistry";
import { detectFinanceJob } from "@/lib/finance/financeEngine";

type JobForScoring = {
  title?: string | null;
  description?: string | null;
  budget?: number | null;
  pay_amount?: number | null;
  type?: string | null;
  remote?: boolean | null;
  platform?: string | null;
  platformWeight?: number | null;
};

export function scoreJob(job: JobForScoring) {
  let score = 0;
  const budget = Number(job.budget ?? job.pay_amount ?? 0);
  const title = String(job.title || "").toLowerCase();

  if (job.remote) score += 3;
  if (budget > 300) score += 2;
  if (String(job.type || "").toLowerCase() === "long_term") score += 3;

  const platformWeight = Number(job.platformWeight ?? getPlatformWeight(job.platform));
  score += platformWeight * 2;

  if (title.includes("admin")) score += 2;
  if (title.includes("virtual assistant")) score += 3;

  if (detectFinanceJob({ description: String(job.description || "") })) {
    score += 4;
  }

  return Number(score.toFixed(2));
}
