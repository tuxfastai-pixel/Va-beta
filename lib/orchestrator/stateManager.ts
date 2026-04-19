import { buildTransparentEarningsSummary } from "@/lib/earnings/tracker";

export type UserState =
  | "onboarding"
  | "ready"
  | "hunting"
  | "applying"
  | "conversing"
  | "working"
  | "earning";

export type EarningsTracker = ReturnType<typeof buildTransparentEarningsSummary> & {
  pending: number;
  withdrawn: number;
  by_platform: Record<string, number>;
};

type UserLike = {
  platformsCompleted?: boolean | number | null;
  profileReady?: boolean | null;
  activeJobs?: unknown[] | number | null;
  pendingProposals?: unknown[] | number | null;
  activeClients?: unknown[] | number | null;
  activeWork?: unknown[] | number | null;
  job_queue?: unknown[];
  proposal_queue?: unknown[];
  earnings_tracker?: Partial<EarningsTracker>;
};

function asCount(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  return Number(value || 0);
}

function isTruthyCount(value: unknown) {
  return asCount(value) > 0;
}

function platformsAreComplete(value: boolean | number | null | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  return Number(value || 0) >= 5;
}

export function getUserState(user: UserLike): UserState {
  if (!platformsAreComplete(user.platformsCompleted)) return "onboarding";
  if (!user.profileReady) return "ready";
  if (!isTruthyCount(user.activeJobs) && !isTruthyCount(user.pendingProposals) && !isTruthyCount(user.activeClients) && !isTruthyCount(user.activeWork)) {
    return "hunting";
  }
  if (isTruthyCount(user.pendingProposals)) return "applying";
  if (isTruthyCount(user.activeClients)) return "conversing";
  if (isTruthyCount(user.activeWork)) return "working";
  return "earning";
}

export function buildUserSystemState(user: UserLike) {
  const earningsTracker: EarningsTracker = {
    total_earned: Number(user.earnings_tracker?.total_earned || 0),
    ai_generated: Number(user.earnings_tracker?.ai_generated || 0),
    user_generated: Number(user.earnings_tracker?.user_generated || 0),
    platform_cut: Number(user.earnings_tracker?.platform_cut || 0),
    user_receives: Number(user.earnings_tracker?.user_receives || 0),
    pending: Number(user.earnings_tracker?.pending || 0),
    withdrawn: Number(user.earnings_tracker?.withdrawn || 0),
    by_platform: user.earnings_tracker?.by_platform || {},
  };

  return {
    job_queue: Array.isArray(user.job_queue) ? user.job_queue : [],
    proposal_queue: Array.isArray(user.proposal_queue) ? user.proposal_queue : [],
    active_clients: Array.isArray(user.activeClients) ? user.activeClients : [],
    earnings_tracker: earningsTracker,
  };
}
