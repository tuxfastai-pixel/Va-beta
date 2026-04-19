import { discoverJobs } from "../jobs/discovery.ts";
import { rankJobs } from "../jobs/ranking.ts";
import { applyToJob } from "../jobs/apply.ts";
import { logEvent } from "../system/logging.ts";

type WorkerProfile = {
  user_id?: string;
  worker_name?: string;
  markets?: string[];
};

type RankedJob = {
  id?: string | number;
  title?: string;
  company?: string;
  company_name?: string;
  industry?: string;
  category?: string;
  description?: string;
  client_response?: string;
  pay_amount?: number | string;
  salary?: number | string;
  [key: string]: unknown;
};

export async function runWorker(worker: WorkerProfile) {
  console.log("AI Worker running:", worker.worker_name);

  if (!worker.user_id) {
    throw new Error("worker.user_id is required");
  }

  const jobs = await discoverJobs(worker.user_id, worker.markets || []);
  const ranked = (await rankJobs(worker, jobs as RankedJob[])) as RankedJob[];
  const topJobs = ranked.slice(0, 5);
  const earnings = topJobs.reduce(
    (sum, job) => sum + Number(job.pay_amount || job.salary || 0),
    0
  );

  logEvent({
    type: "jobs_discovered",
    worker_name: worker.worker_name,
    count: jobs.length,
  });

  for (const job of topJobs) {
    await applyToJob(worker, job);
  }

  logEvent({
    type: "applications_sent",
    worker_name: worker.worker_name,
    count: topJobs.length,
  });

  logEvent({
    type: "earnings",
    worker_name: worker.worker_name,
    amount: earnings,
  });

  return {
    workerName: worker.worker_name,
    jobsFoundToday: jobs.length,
    applicationsSent: topJobs.length,
    markets: worker.markets || [],
    earnings,
  };
}
