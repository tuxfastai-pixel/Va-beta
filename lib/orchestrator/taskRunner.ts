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
  identity_label?: string | null;
  ats_keywords?: string[] | null;
  profile_confidence?: number | null;
  identity_stability?: number | null;
  reinforcement_aggressiveness?: number | null;
  explainability?: {
    governanceSummary?: string;
    whyIdentityChosen?: string[];
    whyATSKeywordsChanged?: string[];
    whyPositioningShifted?: string[];
    whyConfidenceChanged?: string[];
  } | null;
  profile_variants?: Record<string, {
    key?: string;
    label?: string;
    channel?: string;
    optimizedHeadline?: string;
    summary?: string;
    prioritizedKeywords?: string[];
    appliedThrottle?: number;
  }> | null;
  resume_variants?: Record<string, {
    key?: string;
    sourceProfileVariant?: string;
    label?: string;
    headline?: string;
    text?: string;
    prioritizedKeywords?: string[];
    deploymentWeight?: number;
  }> | null;
  primary_resume_variant?: string | null;
  resume_realism?: number | null;
  resume_deployment_throttle?: number | null;
  lastClientMessage?: string | null;
  clientReady?: boolean | null;
  job_queue?: unknown[];
  activeWork?: unknown[] | number | null;
};

function resolveUserId(user: OrchestratorUser) {
  return String(user.id || user.user_id || "").trim();
}

function mapPlatformToVariantKey(platform: string): string {
  const normalized = platform.toLowerCase().trim();
  if (normalized.includes("linkedin")) return "linkedin_profile";
  if (normalized.includes("indeed")) return "indeed_profile";
  if (normalized.includes("flex")) return "flexjobs_profile";
  if (normalized.includes("tender") || normalized.includes("rfp") || normalized.includes("rfq")) return "tender_profile";
  if (normalized.includes("freelance") || normalized.includes("upwork") || normalized.includes("fiverr")) return "freelance_profile";
  if (normalized.includes("sales")) return "sales_profile";
  if (normalized.includes("finance")) return "finance_profile";
  return "indeed_profile";
}

function mapPlatformToResumeVariantKey(platform: string): string {
  const normalized = platform.toLowerCase().trim();
  if (normalized.includes("linkedin")) return "linkedin_resume";
  if (normalized.includes("indeed")) return "indeed_resume";
  if (normalized.includes("flex")) return "flexjobs_resume";
  if (normalized.includes("tender") || normalized.includes("rfp") || normalized.includes("rfq")) return "tender_resume";
  if (normalized.includes("freelance") || normalized.includes("upwork") || normalized.includes("fiverr")) return "freelance_resume";
  return "corporate_operations_resume";
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

export async function runJobHunterForCareer(
  user: OrchestratorUser,
  career?: string,
  options?: { limit?: number }
) {
  return await safeRun((payload) => jobHunterAgent(payload), {
    ...user,
    careerFocus: career,
    jobLimit: options?.limit,
  } as OrchestratorUser & { careerFocus?: string; jobLimit?: number });
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
      const platform = String((job as { platform?: unknown }).platform || "");
      const variantKey = mapPlatformToVariantKey(platform);
      const variant = user.profile_variants?.[variantKey];
      const resumeVariantKey = mapPlatformToResumeVariantKey(platform);
      const resumeVariant = user.resume_variants?.[resumeVariantKey] || (user.primary_resume_variant ? user.resume_variants?.[user.primary_resume_variant] : undefined);
      const selectedKeywords = Array.isArray(variant?.prioritizedKeywords)
        ? variant.prioritizedKeywords
        : Array.isArray(user.ats_keywords)
          ? user.ats_keywords
          : [];

      const proposal = await safeRun((payload) => proposalAgent(payload.job, payload.user), {
        job: job as Record<string, unknown>,
        user: {
          ...user,
          identity_label: String(variant?.optimizedHeadline || user.identity_label || ""),
          ats_keywords: selectedKeywords,
          resume: String(resumeVariant?.text || user.resume || ""),
        },
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
    const platform = String((job as { platform?: unknown }).platform || "");
    const variantKey = mapPlatformToVariantKey(platform);
    const variant = user.profile_variants?.[variantKey];
    const resumeVariantKey = mapPlatformToResumeVariantKey(platform);
    const resumeVariant = user.resume_variants?.[resumeVariantKey] || (user.primary_resume_variant ? user.resume_variants?.[user.primary_resume_variant] : undefined);
    const selectedKeywords = Array.isArray(variant?.prioritizedKeywords)
      ? variant.prioritizedKeywords
      : Array.isArray(user.ats_keywords)
        ? user.ats_keywords
        : [];

    const scopedUser = {
      ...user,
      identity_label: String(variant?.optimizedHeadline || user.identity_label || ""),
      ats_keywords: selectedKeywords,
      resume: String(resumeVariant?.text || user.resume || ""),
    };

    const proposal = await safeRun((payload) => proposalAgent(payload.job, payload.user), {
      job: job as Record<string, unknown>,
      user: scopedUser,
    });
    const proposalText = String(proposal.data || "");
    const aggressiveness = Math.max(0.35, Math.min(1, Number(user.reinforcement_aggressiveness || 1)));
    const autoSubmitThreshold = Number((0.78 + (1 - aggressiveness) * 0.17).toFixed(2));
    const shouldAutoSubmit = Boolean(
      userId &&
      user.autonomous_mode !== false &&
      user.autoApplyEnabled === true &&
      proposal.success &&
      proposal.confidence >= autoSubmitThreshold
    );

    if (shouldAutoSubmit && userId) {
      await applyToJob(
        { user_id: userId, resume: scopedUser.resume, profile: user.profile },
        { ...(job as Record<string, unknown>), client_response: "awaiting_response" }
      );

      await recordEvent(userId, "proposal_sent", {
        job_id: String((job as { id?: unknown }).id || "unknown"),
        confidence: proposal.confidence,
        identity_label: String(scopedUser.identity_label || ""),
        ats_keywords: selectedKeywords,
        profile_confidence: Number(user.profile_confidence || 0),
        identity_stability: Number(user.identity_stability || 0),
        reinforcement_aggressiveness: aggressiveness,
        auto_submit_threshold: autoSubmitThreshold,
        selected_variant: variantKey,
        selected_resume_variant: resumeVariantKey,
        resume_variant_label: String(resumeVariant?.label || ""),
        resume_realism: Number(user.resume_realism || 0),
        resume_deployment_throttle: Number(user.resume_deployment_throttle || 1),
        variant_throttle: Number(variant?.appliedThrottle || 1),
        explainability_summary: String(user.explainability?.governanceSummary || ""),
        why_identity_chosen: Array.isArray(user.explainability?.whyIdentityChosen) ? user.explainability?.whyIdentityChosen : [],
        why_keywords_changed: Array.isArray(user.explainability?.whyATSKeywordsChanged) ? user.explainability?.whyATSKeywordsChanged : [],
        why_positioning_shifted: Array.isArray(user.explainability?.whyPositioningShifted) ? user.explainability?.whyPositioningShifted : [],
        why_confidence_changed: Array.isArray(user.explainability?.whyConfidenceChanged) ? user.explainability?.whyConfidenceChanged : [],
        text: String((job as { description?: unknown; title?: unknown }).description || (job as { title?: unknown }).title || ""),
        platform,
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

export async function runProposalEngineForCareer(
  user: OrchestratorUser,
  career?: string,
  options?: { limit?: number }
) {
  const discovery = await runJobHunterForCareer(user, career, options);
  const scopedUser = {
    ...user,
    job_queue: Array.isArray(discovery.data) ? discovery.data : [],
  };

  return await runProposalEngine(scopedUser);
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
