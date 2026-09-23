import { normalizeJob } from "@/lib/platforms/normalizeJob";
import { scoreJob } from "@/lib/ai/jobScorer";
import { getPlatformWeight } from "@/lib/platforms/platformRegistry";
import { fetchCareerJunctionJobs } from "@/lib/platforms/connectors/careerjunction";
import { fetchCareers24Jobs } from "@/lib/platforms/connectors/careers24";
import { fetchIndeedJobs } from "@/lib/platforms/connectors/indeed";
import { fetchPNetJobs } from "@/lib/platforms/connectors/pnet";

type RawJob = {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  source?: string;
};

export function normalizeConnectorJob(raw: RawJob, source: string) {
  const description = String(raw.description || "");
  const remote = /remote|work from home|hybrid/i.test(description);
  const type = /12 months|contract|ongoing|permanent/i.test(description) ? "long_term" : "short_term";
  const platformWeight = getPlatformWeight(source);
  const score = scoreJob({
    title: raw.title,
    description,
    platform: source,
    platformWeight,
    remote,
    type,
  });

  return {
    ...normalizeJob({
      title: raw.title,
      description,
      platform: source,
      platformWeight,
      remote,
      type,
    }),
    link: String(raw.link || ""),
    score,
    createdAt: raw.pubDate ? new Date(raw.pubDate) : new Date(),
  };
}

export async function fetchAllJobs() {
  const [indeed, pnet, cj, careers24] = await Promise.all([
    fetchIndeedJobs(),
    fetchPNetJobs(),
    fetchCareerJunctionJobs(),
    fetchCareers24Jobs(),
  ]);

  return [...indeed, ...pnet, ...cj, ...careers24].map((job) =>
    normalizeConnectorJob(job, String(job.source || "unknown"))
  );
}
