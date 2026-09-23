import { NextRequest, NextResponse } from "next/server";
import {
  getUserGoal,
  createGoal,
  updateGoalProgress,
  getGoalAchievements,
} from "@/lib/autonomy/scaleEngine";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSessionUser } from "@/lib/auth/sessionUser";

/**
 * GET /api/goals
 * Get user's active goal
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = req.nextUrl.searchParams.get("userId");
    const goalType = req.nextUrl.searchParams.get("type") || "income";

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter required" },
        { status: 400 }
      );
    }

    if (userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const goal = await getUserGoal(userId, goalType);

    if (!goal) {
      return NextResponse.json(
        { goal: null, message: "No active goal found" },
        { status: 200 }
      );
    }

    const achievements = await getGoalAchievements(goal.id);

    return NextResponse.json({
      goal,
      achievements,
      progress: {
        current: goal.current_amount,
        target: goal.target_amount,
        percentage: Math.min(100, (goal.current_amount / goal.target_amount) * 100),
      },
    });
  } catch (error) {
    console.error("Fetch goal error:", error);
    return NextResponse.json({ error: "Failed to fetch goal" }, { status: 500 });
  }
}

/**
 * POST /api/goals
 * Create new goal
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, targetAmount, goalType, options } = body;

    if (!userId || !targetAmount) {
      return NextResponse.json(
        { error: "userId and targetAmount required" },
        { status: 400 }
      );
    }

    if (userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const goal = await createGoal(userId, targetAmount, goalType, options);

    if (!goal) {
      return NextResponse.json(
        { error: "Failed to create goal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "created",
      goal,
      message: `Goal created: $${targetAmount}`,
    });
  } catch (error) {
    console.error("Create goal error:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/goals
 * Update goal progress or settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { goalId, amountToAdd, update } = body;

    if (!goalId) {
      return NextResponse.json(
        { error: "goalId required" },
        { status: 400 }
      );
    }

    const { data: ownedGoal, error: ownershipError } = await supabaseServer
      .from("goals")
      .select("id, user_id")
      .eq("id", goalId)
      .eq("user_id", session.userId)
      .maybeSingle();

    if (ownershipError || !ownedGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Update progress
    if (amountToAdd) {
      const updated = await updateGoalProgress(goalId, amountToAdd);

      if (!updated) {
        return NextResponse.json(
          { error: "Failed to update progress" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: "updated",
        goal: updated,
        message: `Progress updated by $${amountToAdd}`,
      });
    }

    // Update goal settings
    if (update) {
      const { error } = await supabaseServer
        .from("goals")
        .update(update)
        .eq("id", goalId);

      if (error) throw error;

      const { data: updated } = await supabaseServer
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .single();

      return NextResponse.json({
        status: "updated",
        goal: updated,
        message: "Goal settings updated",
      });
    }

    return NextResponse.json(
      { error: "amountToAdd or update required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Update goal error:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}
