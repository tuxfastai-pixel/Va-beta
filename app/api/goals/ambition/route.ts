import { NextRequest, NextResponse } from "next/server";
import { getUserAmbition, setUserAmbition } from "@/lib/autonomy/ambitionEngine";

/**
 * GET /api/goals/ambition
 * Get user's ambition level
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter required" },
        { status: 400 }
      );
    }

    const ambition = await getUserAmbition(userId);

    return NextResponse.json({
      ambition,
      levels: ["normal", "high", "elite"],
    });
  } catch (error) {
    console.error("Fetch ambition error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ambition level" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/ambition
 * Set user's ambition level
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, level } = body;

    if (!userId || !level) {
      return NextResponse.json(
        { error: "userId and level required" },
        { status: 400 }
      );
    }

    if (!["normal", "high", "elite"].includes(level)) {
      return NextResponse.json(
        { error: "Invalid ambition level" },
        { status: 400 }
      );
    }

    const success = await setUserAmbition(userId, level);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to set ambition level" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "updated",
      ambition: level,
      message: `Ambition level set to ${level}`,
    });
  } catch (error) {
    console.error("Set ambition error:", error);
    return NextResponse.json(
      { error: "Failed to set ambition level" },
      { status: 500 }
    );
  }
}
