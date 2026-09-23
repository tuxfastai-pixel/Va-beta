import { NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, error: "Orchestrator authentication is not configured" },
        { status: 503 }
      );
    }

    if (auth !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { userId?: string; auto?: boolean };
    const userId = String(body.userId || "").trim();
    const auto = Boolean(body.auto);

    const result = await runOrchestrator({
      userId: auto ? "" : userId,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    console.error("Orchestrator error:", err);

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown orchestrator error" },
      { status: 500 }
    );
  }
}
