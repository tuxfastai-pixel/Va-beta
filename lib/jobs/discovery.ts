import { ingestJobs } from "./ingestionPipeline.ts";

export async function discoverJobs(userId: string, markets: string[] = []) {
  return ingestJobs(userId, markets);
}
