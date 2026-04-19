import crypto from "crypto";
import { getOrSetCache } from "../cache/performanceCache.ts";

type WorkerProfile = {
  user_id?: string;
  worker_name?: string;
  markets?: string[];
};

type RankedJob = {
  id?: string | number;
  external_id?: string | number;
  title?: string;
  company?: string;
  country?: string;
  currency?: string;
  pay_currency?: string;
  pay_amount?: string | number;
  salary?: string | number;
  ranking_score?: number;
  [key: string]: unknown;
};

const marketPriority: Record<string, number> = {
  US: 1.0,
  UK: 0.9,
  UAE: 0.85,
  ZA: 0.6,
};

const currencyPriority: Record<string, number> = {
  USD: 1.0,
  GBP: 0.95,
  EUR: 0.9,
  AED: 0.85,
  ZAR: 0.6,
};

function marketWeight(job: RankedJob) {
  const country = String(job.country || "").toUpperCase();

  if (country.includes("US") || country.includes("UNITED STATES")) {
    return marketPriority.US;
  }

  if (country.includes("UK") || country.includes("UNITED KINGDOM")) {
    return marketPriority.UK;
  }

  if (country.includes("UAE") || country.includes("DUBAI") || country.includes("UNITED ARAB EMIRATES")) {
    return marketPriority.UAE;
  }

  if (country.includes("ZA") || country.includes("SOUTH AFRICA")) {
    return marketPriority.ZA;
  }

  return 0.7;
}

function currencyWeight(job: RankedJob) {
  const currency = String(job.currency || job.pay_currency || "USD").toUpperCase();
  return currencyPriority[currency] ?? 0.7;
}

function payWeight(job: RankedJob) {
  const amount = Number(job.pay_amount || job.salary || 0);
  return Math.min(1.2, Math.max(0.3, amount / 50));
}

export async function rankJobs(worker: WorkerProfile, jobs: RankedJob[]) {
  const preferredMarkets = (worker?.markets || []).map((m) => m.toUpperCase());
  const signature = JSON.stringify({
    workerId: worker?.user_id || worker?.worker_name || "global",
    markets: preferredMarkets,
    jobs: jobs.map((job) => ({
      id: job.id || job.external_id || `${job.title}-${job.company}`,
      country: job.country,
      currency: job.currency || job.pay_currency,
      pay_amount: job.pay_amount || job.salary,
    })),
  });

  const cacheKey = `job_rankings:${crypto.createHash("sha1").update(signature).digest("hex")}`;

  return getOrSetCache(cacheKey, 180, async () =>
    jobs
      .map((job) => {
        const country = String(job.country || "").toUpperCase();
        const preferredBoost = preferredMarkets.some((market) => country.includes(market))
          ? 1.05
          : 1;

        const score = marketWeight(job) * currencyWeight(job) * payWeight(job) * preferredBoost;

        return {
          ...job,
          ranking_score: Number((score * 100).toFixed(2)),
        };
      })
      .sort((a, b) => b.ranking_score - a.ranking_score)
  );
}
