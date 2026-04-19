import { humanDelay } from "@/lib/ai/outputQuality";
import { getDailyTarget } from "@/lib/analytics/conversionKpi";
import { applyToJob } from "@/lib/jobs/apply";
import { safeRun } from "@/lib/agents/safeRun";
import { recordEvent } from "@/lib/learning/learningEngine";
import { conversationAgent } from "@/lib/agents/conversationAgent";
import { executionAgent } from "@/lib/agents/executionAgent";
import { jobHunterAgent } from "@/lib/agents/jobHunterAgent";
import { optimizerAgent } from "@/lib/agents/optimizerAgent";
import { proposalAgent } from "@/lib/agents/proposalAgent";
import { supabaseServer } from "@/lib/supabaseServer";

type OrchestratorUser = {
  id?: string;
  user_id?: string;
  skills?: string[] | string | null;
  autoApplyEnabled?: boolean | null;
  autonomous_mode?: boolean | null;
  safe_mode?: boolean | null;
  trusted?: boolean | null;
  applicationsToday?: number | null;
  allowAutoSendMessages?: boolean | null;
  resume?: string | null;
  profile?: string | null;
  lastClientMessage?: string | null;
  clientReady?: boolean | null;
  job_queue?: unknown[];
  activeWork?: unknown[] | number | null;
};

function resolveUserId(user: OrchestratorUser) {
  return String(user.id || user.user_id || "").trim();
}

async function getApplicationsToday(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseServer
    .from("learning_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "proposal_sent")
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    return 0;
  }

  return (data || []).length;
}

async function getDailyKPI(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseServer
    .from("learning_events")
    .select("event_type, metadata")
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    return {
      applications: 0,
      replies: 0,
      conversions: 0,
      revenue: 0,
      win_rate: 0,
      target: getDailyTarget(),
    };
  }

  const events = data || [];
  const applications = events.filter((event) => event.event_type === "proposal_sent").length;
  const replies = events.filter((event) => event.event_type === "client_reply").length;
  const conversions = events.filter((event) => event.event_type === "job_won").length;
  const revenue = events
    .filter((event) => event.event_type === "job_won")
    .reduce((sum, event) => {
      const amount = Number((event.metadata as { amount?: unknown })?.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

  return {
    applications,
    replies,
    conversions,
    revenue,
    win_rate: applications > 0 ? Number(((conversions / applications) * 100).toFixed(1)) : 0,
    target: getDailyTarget(),
  };
}

export async function runJobHunter(user: OrchestratorUser) {
  return await safeRun((payload) => jobHunterAgent(payload), user);
}

export async function runProposalEngine(user: OrchestratorUser) {
  const discovery = Array.isArray(user.job_queue) && user.job_queue.length > 0
    ? { success: true, data: user.job_queue, confidence: 0.8 }
    : await safeRun((payload) => jobHunterAgent(payload), user);

  const jobs = Array.isArray(discovery.data) ? discovery.data.slice(0, 3) : [];
  const proposals = [] as Array<{ job_id: string; title: string; proposal: string; confidence: number; submitted: boolean }>;
  const userId = resolveUserId(user);
  const applicationsToday = userId ? await getApplicationsToday(userId) : 0;

  if (user.autoApplyEnabled === false || user.safe_mode || !user.trusted) {
    for (const job of jobs) {
      const proposal = await safeRun((payload) => proposalAgent(payload.job, payload.user), {
        job: job as Record<string, unknown>,
        user,
      });

      proposals.push({
        job_id: String((job as { id?: unknown }).id || "unknown"),
        title: String((job as { title?: unknown }).title || "Untitled"),
        proposal: String(proposal.data || ""),
        confidence: Math.round(proposal.confidence * 100),
        submitted: false,
      });
    }

    return {
      success: true,
      status: "manual_review_required",
      data: proposals,
      confidence: 0.85,
      kpi: userId ? await getDailyKPI(userId) : undefined,
      next_delay_ms: humanDelay(),
    };
  }

  if (applicationsToday >= 10) {
    return {
      success: true,
      status: "rate_limited",
      data: proposals,
      confidence: 0.9,
      feedback: "Application cap reached for today.",
      kpi: userId ? await getDailyKPI(userId) : undefined,
      next_delay_ms: humanDelay(),
    };
  }

  for (const job of jobs) {
    const proposal = await safeRun((payload) => proposalAgent(payload.job, payload.user), {
      job: job as Record<string, unknown>,
      user,
    });
    const proposalText = String(proposal.data || "");
    const shouldAutoSubmit = Boolean(
      userId &&
      user.autonomous_mode !== false &&
      user.autoApplyEnabled === true &&
      proposal.success &&
      proposal.confidence >= 0.8
    );

    if (shouldAutoSubmit && userId) {
      await applyToJob(
        { user_id: userId, resume: user.resume, profile: user.profile },
        { ...(job as Record<string, unknown>), client_response: "awaiting_response" }
      );

      await recordEvent(userId, "proposal_sent", {
        job_id: String((job as { id?: unknown }).id || "unknown"),
        confidence: proposal.confidence,
      });
    }

    proposals.push({
      job_id: String((job as { id?: unknown }).id || "unknown"),
      title: String((job as { title?: unknown }).title || "Untitled"),
      proposal: proposalText,
      confidence: Math.round(proposal.confidence * 100),
      submitted: shouldAutoSubmit,
    });
  }

  return {
    success: true,
    status: user.autonomous_mode === false ? "queued" : "submitted",
    data: proposals,
    confidence: 0.88,
    kpi: userId ? await getDailyKPI(userId) : undefined,
    next_delay_ms: humanDelay(),
  };
}

export async function runClientAI(user: OrchestratorUser) {
  const message = String(user.lastClientMessage || "Thanks for your message.");

  if (user.safe_mode || user.allowAutoSendMessages === false) {
    return {
      success: true,
      data: "Manual review required before sending client replies in safe mode.",
      confidence: 0.9,
      feedback: "Safe mode blocked auto-send.",
    };
  }

  const result = await safeRun((payload) => conversationAgent(payload.message, payload.clientReady), {
    message,
    clientReady: Boolean(user.clientReady),
  });
  const userId = resolveUserId(user);

  if (userId) {
    await recordEvent(userId, "client_reply", {
      clientReady: Boolean(user.clientReady),
      confidence: result.confidence,
    });
  }

  return result;
}

export async function runTaskExecution(user: OrchestratorUser) {
  const result = await safeRun((payload) => executionAgent(payload), {
    description: Array.isArray(user.activeWork)
      ? `Execute ${user.activeWork.length} active tasks with a structured workflow.`
      : "Execute the current work queue efficiently.",
  });

  return result;
}

export async function optimizeUser(user: OrchestratorUser) {
  return await safeRun((payload) => optimizerAgent(payload), user);
}

export async function runTask(action: string, user: OrchestratorUser) {
  switch (action) {
    case "find_jobs":
      return await runJobHunter(user);
    case "send_proposals":
      return await runProposalEngine(user);
    case "reply_to_clients":
      return await runClientAI(user);
    case "execute_tasks":
      return await runTaskExecution(user);
    case "optimize_earnings":
      return await optimizeUser(user);
    default:
      return null;
  }
}
