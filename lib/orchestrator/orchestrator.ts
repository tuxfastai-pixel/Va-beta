import { recordEvent } from "@/lib/learning/learningEngine";
import { supabaseServer } from "@/lib/supabaseServer";
import { decideNextAction } from "./decisionEngine";
import { buildUserSystemState, getUserState } from "./stateManager";
import { runJobHunter, runProposalEngine, runTask } from "./taskRunner";

type OrchestratorUser = {
  id?: string;
  user_id?: string;
  skills?: string[] | string | null;
  resume?: string | null;
  profile?: string | null;
  autonomous_mode?: boolean | null;
  autoApplyEnabled?: boolean | null;
  safe_mode?: boolean | null;
  system_paused?: boolean | null;
  trusted?: boolean | null;
  allowAutoSendMessages?: boolean | null;
  job_queue?: unknown[];
  pendingProposals?: unknown[] | number | null;
  activeClients?: unknown[] | number | null;
  activeWork?: unknown[] | number | null;
  earnings_tracker?: Record<string, unknown>;
  platformsCompleted?: boolean | number | null;
  profileReady?: boolean | null;
};

function resolveUserId(user: OrchestratorUser) {
  return String(user.id || user.user_id || "").trim() || null;
}

function isMissingOrchestratorTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("orchestrator_logs") && (message.includes("could not find the table") || message.includes("does not exist"));
}

async function logOrchestratorRun(userId: string | null, state: string, action: string, result: unknown) {
  const { error } = await supabaseServer.from("orchestrator_logs").insert({
    user_id: userId,
    state,
    action,
    result,
    created_at: new Date().toISOString(),
  });

  if (error && !isMissingOrchestratorTable(error)) {
    console.error(`Failed to log orchestrator run: ${error.message}`);
  }
}

export async function runRevenueLoop(user: OrchestratorUser) {
  const discovery = await runJobHunter(user as Parameters<typeof runJobHunter>[0]);
  const topJobs = Array.isArray(discovery?.data) ? discovery.data : [];
  const proposalRun = await runProposalEngine({
    ...user,
    job_queue: topJobs,
  } as Parameters<typeof runProposalEngine>[0]);
  const userId = resolveUserId(user);

  if (userId) {
    await recordEvent(userId, "revenue_loop_run", {
      jobs_considered: topJobs.length,
      autoApplyEnabled: user.autoApplyEnabled !== false,
    });
  }

  return {
    jobs_considered: topJobs.length,
    top_jobs: topJobs,
    proposals: proposalRun?.data || [],
    discovery_feedback: discovery?.feedback,
  };
}

export async function runOrchestrator(user: OrchestratorUser) {
  const stateContext = buildUserSystemState(user);
  const normalizedUser = {
    ...user,
    ...stateContext,
    safe_mode: user.safe_mode ?? true,
    allowAutoSendMessages: user.safe_mode ? false : (user.allowAutoSendMessages ?? true),
    autoApplyEnabled: user.safe_mode || !user.trusted ? false : (user.autoApplyEnabled ?? true),
  };

  if (normalizedUser.system_paused) {
    const pausedResult = {
      status: "paused",
      message: "System is manually paused",
    };

    await logOrchestratorRun(resolveUserId(normalizedUser), "paused", "paused", pausedResult);
    return pausedResult;
  }

  const state = getUserState(normalizedUser);

  console.log("STATE:", state);

  if (normalizedUser.autonomous_mode === false) {
    const preview = {
      state,
      action: "awaiting_user_action",
      result: null,
      context: stateContext,
    };

    await logOrchestratorRun(resolveUserId(normalizedUser), state, "awaiting_user_action", preview.result);
    return preview;
  }

  const action = decideNextAction(state, normalizedUser);
  console.log("ACTION:", action);

  const result = action === "find_jobs" || action === "send_proposals"
    ? await runRevenueLoop(normalizedUser)
    : await runTask(action, normalizedUser as Parameters<typeof runTask>[1]);

  await logOrchestratorRun(resolveUserId(normalizedUser), state, action, result);

  return {
    state,
    action,
    result,
    context: stateContext,
  };
}
