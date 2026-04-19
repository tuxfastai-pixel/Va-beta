import { crawlJobSources } from "./crawler";
import { applyToJob } from "./apply";
import { generateProposalTemplate } from "@/lib/agents/applicationAgent";
import { filterJob } from "@/lib/agents/jobQualityFilter";
import { rankJobsForUser } from "@/lib/orchestrator/decisionEngine";

type ScrapedJob = {
  id: string;
  title?: string | null;
  company?: string | null;
  description?: string | null;
  recommendation?: string | null;
  match_score?: number | null;
  quality_score?: number | null;
  pay_amount?: number | null;
  currency?: string | null;
  scam_risk?: string | null;
  [key: string]: unknown;
};

/** Wraps the multi-source crawler into a single scrapeJobs() call. */
export async function scrapeJobs(): Promise<ScrapedJob[]> {
  const raw = await crawlJobSources();
  return (raw || []).map((job, index) => {
    const candidate = job as Record<string, unknown>;

    return {
      id: String(candidate.id || candidate.external_id || candidate.url || `job-${index}`),
      title: typeof candidate.title === "string" ? candidate.title : null,
      company: typeof candidate.company === "string" ? candidate.company : null,
      description: typeof candidate.description === "string" ? candidate.description : null,
      recommendation: typeof candidate.recommendation === "string" ? candidate.recommendation : null,
      match_score: typeof candidate.match_score === "number" ? candidate.match_score : null,
      quality_score: typeof candidate.quality_score === "number" ? candidate.quality_score : null,
      pay_amount: typeof candidate.pay_amount === "number" ? candidate.pay_amount : null,
      currency: typeof candidate.currency === "string" ? candidate.currency : null,
      scam_risk: typeof candidate.scam_risk === "string" ? candidate.scam_risk : null,
      ...candidate,
    };
  });
}

/**
 * A job is high-value when it clears quality + safety bars.
 * Mirrors the thresholds used in jobMatchPromoter and jobMatcherAgent.
 */
export function isHighValue(job: ScrapedJob): boolean {
  const qualityOk = (job.quality_score ?? 0) >= 60;
  const safetyOk = String(job.scam_risk ?? "unknown").toLowerCase() === "low";
  const payOk = (job.pay_amount ?? 0) > 0;
  return qualityOk && safetyOk && payOk;
}

/**
 * Main discovery → application pipeline.
 *
 * for each scraped job:
 *   if isHighValue → generateProposal (template, no GPT) → applyToJob
 *
 * worker is passed straight through to applyToJob so it can write the
 * application record with the correct user_id.
 */
export async function runJobPipeline(worker: { user_id: string; resume?: string; profile?: string }): Promise<number> {
  const jobs = await scrapeJobs();
  const rankedJobs = rankJobsForUser(jobs, {
    skills: [worker.resume, worker.profile].filter(Boolean).join(", "),
  });
  let applied = 0;

  for (const job of rankedJobs) {
    // Enrich with quality data if not already present
    if (job.quality_score == null || job.scam_risk == null) {
      try {
        const quality = await filterJob(job);
        job.quality_score = quality.quality_score ?? job.quality_score;
        job.scam_risk = quality.scam_risk != null
          ? String(quality.scam_risk) === "low" || Number(quality.scam_risk) < 0.3
            ? "low"
            : "medium"
          : job.scam_risk;
      } catch {
        // skip enrichment if quality filter fails; isHighValue will use defaults
      }
    }

    if (!isHighValue(job)) continue;

    const proposal = generateProposalTemplate(job);

    await applyToJob(
      { user_id: worker.user_id, resume: worker.resume, profile: worker.profile },
      { ...job, client_response: "awaiting_response" }
    );

    // applyToJob logs the application; proposal is available for outreach if needed
    void proposal; // retained for future outreach integration

    applied += 1;
  }

  return applied;
}
