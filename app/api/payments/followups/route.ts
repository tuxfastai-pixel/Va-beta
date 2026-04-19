import { NextResponse } from "next/server";
import { runFollowUps } from "@/lib/payments/followUpScheduler";

export async function POST() {
  try {
    const result = await runFollowUps();

    return NextResponse.json({
      status: "follow-ups executed",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to execute follow-ups",
      },
      { status: 500 }
    );
  }
}