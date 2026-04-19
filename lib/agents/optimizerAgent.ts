import { buildRevenueProjection, getDailyTarget, getScalingPhase } from "@/lib/analytics/conversionKpi";
import { buildTransparentEarningsSummary } from "@/lib/earnings/tracker";
import { analyzePerformance, getLearningEvents, updateProfileAIMemory } from "@/lib/learning/learningEngine";
import { supabaseServer } from "@/lib/supabaseServer";
import type { AgentResult } from "./agentTypes";

type UserLike = {
  id?: string;
  user_id?: string;
};

function resolveUserId(user: UserLike) {
  return String(user.id || user.user_id || "").trim();
}

export async function optimizerAgent(user: UserLike): Promise<AgentResult<Record<string, unknown>>> {
  const userId = resolveUserId(user);
  if (!userId) {
    return {
      success: false,
      data: { suggestion: "Missing user context." },
      confidence: 0.1,
      feedback: "No user_id provided.",
    };
  }

  const { data, error } = await supabaseServer
    .from("earnings")
    .select("amount, ai_assisted, platform, status")
    .eq("user_id", userId);

  const events = await getLearningEvents(userId);
  const performance = analyzePerformance(events);

  if (!error) {
    await updateProfileAIMemory(userId, {
      best_proposal_style: performance.proposalStyle,
      best_job_type: performance.strategy,
      avoid: performance.winRate < 0.3 ? ["high competition jobs"] : [],
    });
  }

  if (error) {
    const scaling = getScalingPhase({ users: 5, totalConversions: performance.wins });
    return {
      success: true,
      data: {
        suggestion: performance.recommendation,
        learning: performance,
        scaling,
        revenue_projection: buildRevenueProjection(5),
        daily_target: getDailyTarget(),
      },
      confidence: 0.8,
      feedback: "Optimization used learning signals only because earnings data was unavailable.",
    };
  }

  const rows = (data || []) as Array<{ amount?: number | null; ai_assisted?: boolean | null; platform?: string | null; status?: string | null }>;
  const summary = buildTransparentEarningsSummary(rows);
  const scaling = getScalingPhase({ users: 10, totalConversions: performance.wins });

  return {
    success: true,
    data: {
      ...summary,
      suggestion: performance.recommendation,
      learning: performance,
      scaling,
      revenue_projection: buildRevenueProjection(10),
      daily_target: getDailyTarget(),
    },
    confidence: 0.95,
    feedback: "Optimization recommendation generated from earnings and learning data.",
  };
}
