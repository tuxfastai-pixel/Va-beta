import { NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator/orchestrator";
import { runTask } from "@/lib/orchestrator/taskRunner";
import { getAllActiveUsers, getUser } from "@/lib/orchestrator/userContext";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type RouteUser = Awaited<ReturnType<typeof getUser>>;

async function runPlatformLoop(user: NonNullable<RouteUser>) {
  return await runOrchestrator(user);
}

async function runInboundLoop(user: NonNullable<RouteUser>) {
  return await runTask("reply_to_clients", user);
}

async function logError(error: unknown, user: NonNullable<RouteUser>) {
  const message = error instanceof Error ? error.message : String(error || "Unknown orchestrator error");

  const { error: insertError } = await supabaseServer.from("orchestrator_logs").insert({
    user_id: user.id,
    state: "error",
    action: "run-orchestrator",
    result: {
      error: message,
      safe_mode: user.safe_mode,
      system_paused: user.system_paused,
    },
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error(`Failed to log orchestrator error: ${insertError.message}`);
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { userId?: string };
    const userId = String(body.userId || "").trim();
    const options = { autoApplyEnabled: true, autonomousMode: true };

    const targetUser = userId ? await getUser(userId, options) : null;
    const users = userId
      ? (targetUser ? [targetUser] : [])
      : await getAllActiveUsers(50, options);

    const results = [] as Array<{ userId: string; status: string; error?: string }>;

    for (const user of users) {
      if (!user) {
        continue;
      }

      if (user.system_paused) {
        results.push({ userId: user.id, status: "paused" });
        continue;
      }

      try {
        await runPlatformLoop(user);
        await runInboundLoop(user);

        results.push({ userId: user.id, status: "completed" });
      } catch (error) {
        await logError(error, user);
        results.push({
          userId: user.id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error || "Unknown error"),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}
