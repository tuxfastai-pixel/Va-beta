import type { Job } from "@/types";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

/**
 * Calculates priority level for a job based on score + platform weight + remote + long-term factors
 * Critical (≥9): Auto-apply + alert immediately
 * High (7–9): Escalation dashboard + manual decision
 * Medium (5–7): Queue for review
 * Low (<5): Ignore or log for learning
 */
export function getPriorityLevel(job: Job): PriorityLevel {
  let score = job.score || 0;

  // Boost for platform weight
  if (job.platformWeight) score += job.platformWeight;

  // Boost for remote + long-term
  if (job.remote) score += 1;
  if (job.longTerm) score += 2;

  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 5) return "medium";
  return "low";
}

/**
 * Filter jobs by priority level
 */
export function filterJobsByPriority(
  jobs: Job[],
  levels: PriorityLevel[]
): Job[] {
  return jobs.filter((job) => levels.includes(getPriorityLevel(job)));
}

/**
 * Get jobs for alerting (critical + high only)
 */
export function getAlertableJobs(jobs: Job[]): Job[] {
  return filterJobsByPriority(jobs, ["critical", "high"]);
}

/**
 * Get jobs for escalation dashboard (high + medium)
 */
export function getEscalationCandidates(jobs: Job[]): Job[] {
  return filterJobsByPriority(jobs, ["high", "medium"]);
}

/**
 * Get auto-apply candidates (critical only)
 */
export function getAutoApplyCandidates(jobs: Job[]): Job[] {
  return filterJobsByPriority(jobs, ["critical"]);
}
