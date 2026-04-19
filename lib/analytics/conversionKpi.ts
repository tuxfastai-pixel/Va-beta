export type DailyKpi = {
  applications: number;
  replies: number;
  conversions: number;
  revenue: number;
  win_rate: number;
};

export function getDailyTarget() {
  return {
    applications: "8-12",
    replies: "3-5",
    conversions: "1 every 2-3 days",
  };
}

export function getScalingPhase(input: { users: number; totalConversions: number }) {
  const users = Math.max(0, Number(input.users || 0));
  const totalConversions = Math.max(0, Number(input.totalConversions || 0));

  if (users <= 5 || totalConversions < 3) {
    return {
      phase: "validation",
      objective: "Prove repeatable wins with a small user cohort",
      checklist: ["3-5 users", "1-3 jobs won"],
    };
  }

  if (users <= 10) {
    return {
      phase: "optimization",
      objective: "Improve win rate and close quality",
      checklist: ["Strengthen proposals", "Improve closing flow", "Reduce drop-off"],
    };
  }

  if (users <= 25) {
    return {
      phase: "controlled_scale",
      objective: "Scale safely without harming conversion quality",
      checklist: ["Expand to 10 then 25 users", "Keep safety caps", "Monitor daily KPI"],
    };
  }

  return {
    phase: "system_scale",
    objective: "Increase automation while preserving reliability",
    checklist: ["Automation increases", "Manual intervention decreases", "Revenue compounding focus"],
  };
}

export function buildRevenueProjection(userCount: number, cut = 0.2) {
  const users = Math.max(1, Number(userCount || 1));
  const avgPerUser = users <= 5 ? 200 : users <= 20 ? 300 : 400;
  const total = users * avgPerUser;
  const platformCut = Number((total * cut).toFixed(2));

  return {
    users,
    avg_earnings_per_user: avgPerUser,
    total_earnings: total,
    your_cut: platformCut,
    user_payout_total: Number((total - platformCut).toFixed(2)),
    cut_percentage: Number((cut * 100).toFixed(1)),
  };
}
