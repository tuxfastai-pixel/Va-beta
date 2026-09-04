import type { Job } from "@/types";

export interface AutoApplyStats {
  appliedToday: number;
  appliedThisMonth: number;
  lastAppliedAt?: Date;
}

const RATE_LIMIT_PER_DAY = 20;
const RATE_LIMIT_PER_MONTH = 400;

/**
 * Determines if a job should be auto-applied
 *
 * HARD RULES:
 * - Score ≥ 8 (high confidence)
 * - Remote or flexible (prefer remote)
 * - No manual answers required
 * - No portfolio required
 * - Not LinkedIn (manual-heavy platform)
 */
export function shouldAutoApply(job: Job): boolean {
  // Hard minimum score
  if ((job.score || 0) < 8) return false;

  // Exclude platforms that typically require manual engagement
  if (job.platform?.toLowerCase() === "linkedin") return false;

  // Must not require manual answers or portfolio
  if (job.requiresManualAnswers || job.requiresPortfolio) return false;

  // Prefer remote, but not absolute requirement
  // (some high-score jobs might be worth applying to even if not remote)

  // Must have a clear apply link
  if (!job.link) return false;

  return true;
}

/**
 * Checks if auto-apply should be blocked due to rate limiting
 */
export function canAutoApply(stats: AutoApplyStats): boolean {
  // Daily limit check
  if (stats.appliedToday >= RATE_LIMIT_PER_DAY) {
    return false;
  }

  // Monthly limit check
  if (stats.appliedThisMonth >= RATE_LIMIT_PER_MONTH) {
    return false;
  }

  return true;
}

/**
 * Validates job is safe for auto-apply (comprehensive check)
 */
export function isAutoApplySafe(job: Job, stats: AutoApplyStats): boolean {
  return shouldAutoApply(job) && canAutoApply(stats);
}

/**
 * Get rejection reason if not auto-applicable
 */
export function getAutoApplyReason(job: Job, stats: AutoApplyStats): string | null {
  if ((job.score || 0) < 8) return "Score too low (< 8)";
  if (job.platform?.toLowerCase() === "linkedin")
    return "LinkedIn requires manual engagement";
  if (job.requiresManualAnswers) return "Requires custom answers";
  if (job.requiresPortfolio) return "Requires portfolio submission";
  if (!job.link) return "No apply link found";
  if (stats.appliedToday >= RATE_LIMIT_PER_DAY) return "Daily rate limit reached (20/day)";
  if (stats.appliedThisMonth >= RATE_LIMIT_PER_MONTH) return "Monthly rate limit reached (400/month)";

  return null;
}

/**
 * Get max remaining auto-applies for today
 */
export function getRemainingAutoApplies(stats: AutoApplyStats): number {
  return Math.max(0, RATE_LIMIT_PER_DAY - stats.appliedToday);
}
