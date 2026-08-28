import type { Job } from "@/types";

export type EscalationReason =
  | "requires_portfolio"
  | "requires_custom_answers"
  | "high_pay"
  | "strategic_opportunity"
  | "requires_manual_review";

export interface EscalatedJob extends Job {
  escalationReasons: EscalationReason[];
  manualActionRequired: string;
}

/**
 * Determines if a job should be escalated to manual review
 * These are high-value opportunities where human judgment adds value
 *
 * Escalate if:
 * - Score 7–9 (high but not auto-apply ready)
 * - Requires portfolio / custom answers (manual effort worth it)
 * - High pay (> $2000 or equivalent)
 * - Strategic opportunity (government tender, long-term)
 */
export function shouldEscalate(job: Job): boolean {
  const score = job.score || 0;

  // Not worth escalating if low score
  if (score < 7) return false;

  // Auto-apply ready jobs shouldn't be escalated
  if (score >= 9) return false;

  // Check for escalation triggers
  const hasPortfolioRequirement = Boolean(job.requiresPortfolio);
  const hasCustomAnswers = Boolean(job.requiresManualAnswers);
  const isHighPay = job.budget && job.budget > 2000;
  const isStrategic = Boolean(job.longTerm || job.isGovernmentTender);

  return (
    hasPortfolioRequirement ||
    hasCustomAnswers ||
    isHighPay ||
    isStrategic
  );
}

/**
 * Get reasons why a job is being escalated
 */
export function getEscalationReasons(job: Job): EscalationReason[] {
  const reasons: EscalationReason[] = [];

  if (job.requiresPortfolio) reasons.push("requires_portfolio");
  if (job.requiresManualAnswers) reasons.push("requires_custom_answers");
  if (job.budget && job.budget > 2000) reasons.push("high_pay");
  if (job.longTerm || job.isGovernmentTender) reasons.push("strategic_opportunity");

  return reasons;
}

/**
 * Get human-readable action for escalated job
 */
export function getManualAction(job: Job): string {
  const reasons = getEscalationReasons(job);
  const actions: string[] = [];

  if (reasons.includes("requires_portfolio")) {
    actions.push("Prepare portfolio samples");
  }
  if (reasons.includes("requires_custom_answers")) {
    actions.push("Prepare custom answers");
  }
  if (reasons.includes("high_pay")) {
    actions.push("Review pricing strategy");
  }
  if (reasons.includes("strategic_opportunity")) {
    actions.push("Strategic review needed");
  }

  return actions.join(" → ");
}

/**
 * Build escalation queue from jobs
 */
export function buildEscalationQueue(jobs: Job[]): EscalatedJob[] {
  return jobs
    .filter(shouldEscalate)
    .map((job) => ({
      ...job,
      escalationReasons: getEscalationReasons(job),
      manualActionRequired: getManualAction(job),
    }))
    .sort((a, b) => b.score - a.score); // Sort by score (highest first)
}

/**
 * Get escalation summary for alerts
 */
export function getEscalationSummary(escalatedJobs: EscalatedJob[]): string {
  if (escalatedJobs.length === 0) return "";

  const byScore = {
    high: escalatedJobs.filter((j) => j.score >= 8),
    medium: escalatedJobs.filter((j) => j.score < 8),
  };

  let summary = `\n⚠️ ESCALATION REQUIRED\n\n`;
  summary += `High Value: ${byScore.high.length}\n`;
  summary += `Medium Value: ${byScore.medium.length}\n`;
  summary += `\nOpen dashboard to review`;

  return summary;
}
