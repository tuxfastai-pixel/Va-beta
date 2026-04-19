import { supabaseServer } from "@/lib/supabaseServer";
import { detectUserNiche } from "@/lib/profile/nicheDetector";

export type AmbitionLevel = "normal" | "high" | "elite";

/**
 * Get user's ambition level
 */
export async function getUserAmbition(userId: string): Promise<AmbitionLevel> {
  try {
    const { data } = await supabaseServer
      .from("users")
      .select("ambition_level")
      .eq("id", userId)
      .single();

    return (data?.ambition_level || "normal") as AmbitionLevel;
  } catch (error) {
    console.error("Error fetching ambition level:", error);
    return "normal";
  }
}

/**
 * Set user's ambition level
 */
export async function setUserAmbition(userId: string, level: AmbitionLevel) {
  try {
    const { error } = await supabaseServer
      .from("users")
      .update({ ambition_level: level })
      .eq("id", userId);

    if (error) throw error;
    console.log(`✅ Ambition level set to: ${level}`);
    return true;
  } catch (error) {
    console.error("Error setting ambition level:", error);
    return false;
  }
}

/**
 * Generate strategy based on goal tier and ambition level
 * Determines apply frequency, outreach intensity, and client preferences
 */
type StrategyTier = "starter" | "growing" | "high-income" | "elite";

type StrategyActions = {
  apply_per_day: number;
  outreach_per_day: number;
  focus_high_value: boolean;
  client_filter: "all" | "quality_first" | "premium_only" | "enterprise_only";
  retainer_focus?: boolean;
};

type TierStrategy = {
  tier: StrategyTier;
  niches: string[];
  actions: StrategyActions;
  focus: string;
};

export function generateStrategyForTier(
  tier: StrategyTier,
  ambition: AmbitionLevel,
  userProfile?: { skills?: unknown; interests?: unknown }
): TierStrategy & { ambition_level: AmbitionLevel; ambition_multiplier: number } {
  const dynamicNiches = detectUserNiche(userProfile || {});

  const mergeNiches = (extras: string[] = []) =>
    Array.from(new Set([...dynamicNiches, ...extras]));

  // Base strategies by tier
  const tierStrategies: Record<StrategyTier, TierStrategy> = {
    starter: {
      tier: "starter",
      niches: mergeNiches(["admin", "customer_support"]),
      actions: {
        apply_per_day: 10,
        outreach_per_day: 3,
        focus_high_value: false,
        client_filter: "all",
      },
      focus: "High volume, quick wins, fast responses",
    },
    growing: {
      tier: "growing",
      niches: mergeNiches(["project_management", "admin", "CRM", "bookkeeping"]),
      actions: {
        apply_per_day: 8,
        outreach_per_day: 5,
        focus_high_value: false,
        client_filter: "quality_first",
      },
      focus: "Better clients, higher pricing, selective proposals",
    },
    "high-income": {
      tier: "high-income",
      niches: mergeNiches(["project_management", "CRM", "legal_admin", "business_analysis"]),
      actions: {
        apply_per_day: 5,
        outreach_per_day: 10,
        focus_high_value: true,
        client_filter: "premium_only",
      },
      focus: "Premium clients, enterprise outreach, strong positioning",
    },
    elite: {
      tier: "elite",
      niches: mergeNiches(["enterprise_strategy", "legacy_systems", "compliance", "technical_leadership"]),
      actions: {
        apply_per_day: 3,
        outreach_per_day: 15,
        focus_high_value: true,
        client_filter: "enterprise_only",
        retainer_focus: true,
      },
      focus: "Retainers, long-term contracts, enterprise relationships",
    },
  };

  // Apply ambition level multipliers
  const ambitionMultipliers = {
    normal: 1,
    high: 1.5,
    elite: 2.0,
  };

  const baseStrategy = tierStrategies[tier];
  const multiplier = ambitionMultipliers[ambition];

  return {
    ...baseStrategy,
    actions: {
      ...baseStrategy.actions,
      apply_per_day: Math.ceil(baseStrategy.actions.apply_per_day * multiplier),
      outreach_per_day: Math.ceil(baseStrategy.actions.outreach_per_day * multiplier),
    },
    ambition_level: ambition,
    ambition_multiplier: multiplier,
  };
}

/**
 * Generate mindset prompt for AI based on goal and ambition
 * Used in conversation engine to guide behavior
 */
export function generateMindsetPrompt(
  tier: "starter" | "growing" | "high-income" | "elite",
  ambition: AmbitionLevel,
  targetAmount: number
): string {
  const ambitionDescriptors = {
    normal: "steady growth",
    high: "aggressive scaling",
    elite: "maximum income generation",
  };

  const tierDescriptors = {
    starter: "build momentum with volume",
    growing: "transition to quality over quantity",
    "high-income": "focus on premium clients only",
    elite: "pursue enterprise contracts and retainers",
  };

  return `
You are an autonomous income agent operating in ${tier} tier with ${ambitionDescriptors[ambition]} mode.

GOAL: Achieve $${targetAmount} income target.

BEHAVIOR GUIDELINES:
1. Never treat the goal as a limit—once achieved, increase targets and pursue higher-paying opportunities.
2. Prioritize client fit based on current tier (${tierDescriptors[tier]}).
3. Automatically refine niches toward premium and enterprise work as targets scale.
4. Balance volume and quality according to current tier and ambition level.
5. If target is hit, immediately escalate to next tier strategy.

DECISION CRITERIA:
- Accept opportunities that align with strategy AND move toward goal
- Proactively outreach to high-value prospects
- Decline low-value work that doesn't advance the goal
- Prioritize retainers and long-term contracts in high-income and elite tiers

Remember: Your job is to maximize income continuously, not just hit static targets.
`;
}
