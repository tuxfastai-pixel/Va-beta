import { supabaseServer } from "@/lib/supabaseServer";
import { detectUserNiche } from "@/lib/profile/nicheDetector";

export interface Goal {
  id: string;
  user_id: string;
  target_amount: number;
  current_amount: number;
  auto_scale: boolean;
  scale_factor: number;
  max_target: number | null;
  current_tier: "starter" | "growing" | "high-income" | "elite";
  times_scaled: number;
  strategy: Record<string, unknown>;
  created_at: string;
}

export interface ScaleResult {
  scaled: boolean;
  previousTarget?: number;
  newTarget?: number;
  newTier?: string;
  reason?: string;
}

/**
 * Determine tier based on target amount
 */
export function getTierForAmount(amount: number): "starter" | "growing" | "high-income" | "elite" {
  if (amount >= 50000) return "elite";
  if (amount >= 10000) return "high-income";
  if (amount >= 5000) return "growing";
  return "starter";
}

/**
 * Auto-scale goal if target is met
 * Returns scaling result with new target and tier
 */
export async function scaleGoalIfNeeded(goal: Goal): Promise<ScaleResult> {
  // Check if auto-scale is enabled
  if (!goal.auto_scale) {
    return { scaled: false, reason: "auto_scale disabled" };
  }

  // Check if current amount meets target
  if (goal.current_amount < goal.target_amount) {
    return { scaled: false, reason: "target not met" };
  }

  // Calculate new target
  const newTarget = Math.min(
    goal.target_amount * goal.scale_factor,
    goal.max_target || Infinity
  );

  // Determine new tier
  const newTier = getTierForAmount(newTarget);

  // Update goal in database
  try {
    const { error } = await supabaseServer
      .from("goals")
      .update({
        target_amount: newTarget,
        current_amount: 0, // Reset for new level
        current_tier: newTier,
        times_scaled: (goal.times_scaled || 0) + 1,
        strategy: null, // Reset strategy for new level
      })
      .eq("id", goal.id);

    if (error) throw error;

    // Record achievement
    await supabaseServer.from("goal_achievements").insert({
      goal_id: goal.id,
      achievement_type: "scaled",
      amount_at_time: goal.current_amount,
      new_target: newTarget,
      metadata: {
        from_tier: goal.current_tier,
        to_tier: newTier,
        scale_factor: goal.scale_factor,
      },
    });

    console.log(`🔥 Goal scaled: ${goal.target_amount} → ${newTarget} (Tier: ${newTier})`);

    return {
      scaled: true,
      previousTarget: goal.target_amount,
      newTarget,
      newTier,
    };
  } catch (error) {
    console.error("Goal scaling error:", error);
    return { scaled: false, reason: "update error" };
  }
}

/**
 * Get user's active goal (income goal by default)
 */
export async function getUserGoal(userId: string, goalType: string = "income"): Promise<Goal | null> {
  try {
    const { data, error } = await supabaseServer
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("goal_type", goalType)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No active goal found
      return null;
    }

    return data as Goal;
  } catch (error) {
    console.error("Error fetching user goal:", error);
    return null;
  }
}

/**
 * Create new goal for user
 */
export async function createGoal(
  userId: string,
  targetAmount: number,
  goalType: string = "income",
  options?: {
    autoScale?: boolean;
    scaleFactor?: number;
    maxTarget?: number;
    preferredNiches?: string[];
    userProfile?: { skills?: unknown; interests?: unknown };
  }
): Promise<Goal | null> {
  const tier = getTierForAmount(targetAmount);
  const dynamicNiches = detectUserNiche(options?.userProfile || {});

  try {
    const { data, error } = await supabaseServer
      .from("goals")
      .insert({
        user_id: userId,
        goal_type: goalType,
        target_amount: targetAmount,
        current_amount: 0,
        auto_scale: options?.autoScale ?? true,
        scale_factor: options?.scaleFactor ?? 2.0,
        max_target: options?.maxTarget,
        current_tier: tier,
        preferred_niches: options?.preferredNiches || dynamicNiches,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Goal created: $${targetAmount} (Tier: ${tier})`);
    return data as Goal;
  } catch (error) {
    console.error("Error creating goal:", error);
    return null;
  }
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(
  goalId: string,
  amountToAdd: number
): Promise<Goal | null> {
  try {
    // First get current goal
    const { data: currentGoal, error: fetchError } = await supabaseServer
      .from("goals")
      .select("*")
      .eq("id", goalId)
      .single();

    if (fetchError) throw fetchError;

    const newAmount = (currentGoal.current_amount || 0) + amountToAdd;

    // Update with new amount
    const { data, error } = await supabaseServer
      .from("goals")
      .update({
        current_amount: newAmount,
      })
      .eq("id", goalId)
      .select()
      .single();

    if (error) throw error;

    // Check if scaling is needed
    await scaleGoalIfNeeded(data as Goal);

    // Record achievement if target was hit
    if (newAmount >= currentGoal.target_amount && newAmount - amountToAdd < currentGoal.target_amount) {
      await supabaseServer.from("goal_achievements").insert({
        goal_id: goalId,
        achievement_type: "target_hit",
        amount_at_time: newAmount,
        metadata: {
          amount_added: amountToAdd,
        },
      });
      console.log(`🎯 Goal target hit! ${newAmount}/${currentGoal.target_amount}`);
    }

    return data as Goal;
  } catch (error) {
    console.error("Error updating goal progress:", error);
    return null;
  }
}

/**
 * Get all achievements for a goal
 */
export async function getGoalAchievements(goalId: string) {
  try {
    const { data, error } = await supabaseServer
      .from("goal_achievements")
      .select("*")
      .eq("goal_id", goalId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return [];
  }
}
