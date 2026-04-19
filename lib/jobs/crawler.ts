import { discoverUpworkJobs } from "../agents/sources/upworkSource.ts";
import { discoverRemoteOKJobs } from "../agents/sources/remoteOkSource.ts";
import { discoverIndeedUKJobs } from "../agents/sources/indeedUkSource.ts";
import { getOrSetCache } from "../cache/performanceCache.ts";

type SourceJob = Record<string, unknown>;

export async function crawlJobSources() {
  return getOrSetCache("market_crawls:global", 300, async () => {
    const [upwork, remote, indeed] = await Promise.all([
      discoverUpworkJobs(),
      discoverRemoteOKJobs(),
      discoverIndeedUKJobs(),
    ]);

    return [
      ...upwork.map((job: SourceJob) => ({ ...job, source: "upwork" })),
      ...remote.map((job: SourceJob) => ({ ...job, source: "remoteok" })),
      ...indeed.map((job: SourceJob) => ({ ...job, source: "indeed" })),
    ];
  });
}
