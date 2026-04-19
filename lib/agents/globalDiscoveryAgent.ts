import { discoverUpworkJobs } from "./sources/upworkSource.ts";
import { discoverRemoteOKJobs } from "./sources/remoteOkSource.ts";
import { discoverIndeedUKJobs } from "./sources/indeedUkSource.ts";
import { filterJob, saveQuality, type JobCandidate } from "./jobQualityFilter.ts";

export async function discoverGlobalJobs() {
  const jobs: JobCandidate[] = [];
  const validJobs: Array<JobCandidate & { quality_score: number; scam_risk: number; quality_reason: string }> = [];

  const upwork = await discoverUpworkJobs();
  const remote = await discoverRemoteOKJobs();
  const indeed = await discoverIndeedUKJobs();

  jobs.push(...upwork);
  jobs.push(...remote);
  jobs.push(...indeed);

  for (const job of jobs) {
    const quality = await filterJob(job);
    const jobId = String(job.id ?? job.url ?? "");

    await saveQuality(jobId, quality);

    if (quality.quality_score < 60 || quality.scam_risk >= 0.6) {
      continue;
    }

    validJobs.push({
      ...job,
      quality_score: quality.quality_score,
      scam_risk: quality.scam_risk,
      quality_reason: quality.reason,
    });
  }

  return validJobs;
}
