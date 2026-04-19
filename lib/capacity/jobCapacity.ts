export function canAcceptMoreJobs(activeJobs: number, maxJobs: number) {
  return activeJobs < maxJobs;
}
