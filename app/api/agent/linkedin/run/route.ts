import { NextResponse } from "next/server";
import { runLinkedInAgent } from "@/lib/agents/linkedinAgent";

const SAFE_MODE = String(process.env.SAFE_MODE || "true") === "true";

export async function POST() {
  try {
    if (SAFE_MODE) {
      return NextResponse.json({
        success: true,
        preview: true,
        message: "SAFE_MODE enabled. LinkedIn agent not executed.",
      });
    }

    await runLinkedInAgent();

    return NextResponse.json({
      success: true,
      message: "LinkedIn agent executed",
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
