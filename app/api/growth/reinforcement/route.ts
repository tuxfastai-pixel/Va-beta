import { NextResponse } from "next/server";
import { runReinforcementCycle } from "@/lib/growth/reinforcementEngine";

export async function POST() {
  try {
    const result = await runReinforcementCycle();
    return NextResponse.json({
      success: true,
      message: "Reinforcement cycle executed",
      ...result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
