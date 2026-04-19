import { autoApplyToJobs } from "@/lib/jobs/autoApplyEngine";
import { getUserMode } from "@/lib/mode/modeManager";
import { supabaseServer } from "@/lib/supabaseServer";
import { handleVoiceCommandModeSwitch } from "@/lib/voice/assistant";
import { resetState, updateState, type ConversationState } from "@/lib/voice/stateEngine";
import { checkAccess } from "@/lib/access/accessGuard";
import { getUserGoal } from "@/lib/autonomy/scaleEngine";
import { getUserAmbition, generateStrategyForTier, generateMindsetPrompt } from "@/lib/autonomy/ambitionEngine";
import { classifySkill, generateSkillPath } from "@/lib/skills/skillBuilder";
import { platforms } from "@/lib/platforms/profileSync";

type MemoryRow = {
  content: unknown;
  state?: ConversationState | null;
  created_at?: string | null;
};

type ConversationResult = {
  reply: string;
  action: string;
  metadata?: Record<string, unknown>;
};

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value || "");
}

function detectAction(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("find") && lower.includes("job")) return "fetch_jobs";
  if (lower.includes("apply")) return "auto_apply";
  if (lower.includes("reply") || lower.includes("client")) return "reply_client";
  if (lower.includes("earnings") || lower.includes("income")) return "check_earnings";
  return "conversation";
}

async function getRecentMemory(userId: string, type: "conversation" | "preference" | "strategy", limit = 5) {
  const { data } = await supabaseServer
    .from("ai_memory")
    .select("content, state, created_at")
    .eq("user_id", userId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as MemoryRow[];
}

async function getTopJobMatches(userId: string, minPay = 0, limit = 5) {
  const { data } = await supabaseServer
    .from("job_matches")
    .select("id, title, company, pay_amount, currency, match_score")
    .eq("user_id", userId)
    .gt("match_score", 70)
    .gte("pay_amount", minPay)
    .order("pay_amount", { ascending: false })
    .limit(limit);

  return data || [];
}

async function storeMemory(input: {
  userId: string;
  type: "conversation" | "preference" | "strategy";
  content: string;
  context?: Record<string, unknown>;
  state?: ConversationState;
}) {
  await supabaseServer.from("ai_memory").insert({
    user_id: input.userId,
    type: input.type,
    memory_type: input.type,
    content: input.content,
    state: input.state || null,
    context: input.context || {},
    created_at: new Date().toISOString(),
  });
}

function resolveStateFromMemory(lastMemory: MemoryRow | undefined): ConversationState {
  if (!lastMemory) return resetState();

  const createdAt = Date.parse(String(lastMemory.created_at || ""));
  const stale = Number.isNaN(createdAt) ? false : Date.now() - createdAt > 10 * 60 * 1000;

  if (stale) {
    return resetState();
  }

  return (lastMemory.state || {}) as ConversationState;
}

async function runStateFlow(input: {
  userId: string;
  mode: "assist" | "autonomous";
  state: ConversationState;
}): Promise<ConversationResult | null> {
  const { userId, mode, state } = input;

  if (state.intent !== "job_search") {
    return null;
  }

  if (state.step === "awaiting_confirmation") {
    const minPay = state.filters?.pay === "high" ? 20 : 0;
    const jobs = await getTopJobMatches(userId, minPay, 5);
    const foundCount = jobs.length;

    const payPhrase = state.filters?.pay === "high" ? " high-paying" : "";

    return {
      action: "fetch_jobs",
      reply: `I found ${foundCount}${payPhrase} ${state.filters?.category || ""} jobs. Do you want me to apply?`.replace(
        "  ",
        " "
      ),
      metadata: {
        foundCount,
        mode,
        state,
      },
    };
  }

  if (state.step === "confirmed") {
    if (mode === "assist") {
      return {
        action: "auto_apply",
        reply:
          "I found strong matches for you. In Assist Mode, I can guide you first. If you want execution, switch to Autonomous Mode and I will apply immediately.",
        metadata: { mode, state },
      };
    }

    const applications = await autoApplyToJobs(userId);
    const appliedCount = applications.length;

    await storeMemory({
      userId,
      type: "strategy",
      content: `State flow auto-apply executed. Applied to ${appliedCount} jobs.`,
      context: { appliedCount, filter: state.filters || {} },
    });

    const payDetail = state.filters?.pay === "high" ? " above $20/hour" : "";
    return {
      action: "auto_apply",
      reply: `Done. I applied to ${appliedCount}${payDetail} best-matching jobs and will keep monitoring replies automatically.`,
      metadata: { appliedCount, mode, state },
    };
  }

  return null;
}

function detectRequestedCategory(text: string): string | null {
  const categories = [
    "teaching",
    "writing",
    "admin",
    "assistant",
    "developer",
    "engineering",
    "legal",
    "compliance",
    "finance",
    "bookkeeping",
    "crm",
    "sales",
  ];

  return categories.find((category) => text.includes(category)) ?? null;
}

function detectCareerTrack(category: string | null) {
  if (!category) return null;
  if (["admin", "assistant", "finance", "bookkeeping", "crm"].includes(category)) return "admin";
  if (["writing", "teaching"].includes(category)) return "writing";
  return "general";
}

function buildCareerOnboardingReply(category: string | null) {
  const track = detectCareerTrack(category) || "general";
  const skillPath = generateSkillPath(track);
  const aiExecutable = skillPath.filter((skill) => classifySkill(skill) === "ai_executable");
  const humanRequired = skillPath.filter((skill) => classifySkill(skill) === "human_required");
  const categoryLabel = category === "admin" || category === "assistant" ? "admin work" : `${category || "remote work"}`;

  return {
    action: "start_onboarding",
    reply: [
      `Great — ${categoryLabel} is a strong lane. Here’s the plan:`,
      "",
      `1. Create your accounts: ${platforms.join(", ")}`,
      "2. I’ll help you set up your profiles with both human skills and AI-assisted abilities.",
      "3. I’ll handle applications and execution-ready tasks where possible.",
      "",
      `AI can help immediately with: ${aiExecutable.length > 0 ? aiExecutable.join(", ") : "execution support and task acceleration"}.`,
      `You should practice next: ${humanRequired.join(", ")}.`,
      "",
      "Let’s start with account setup.",
    ].join("\n"),
    metadata: {
      category,
      platforms,
      skillPath,
      aiExecutable,
      humanRequired,
    },
  } satisfies ConversationResult;
}

function isCareerStartIntent(text: string) {
  return (
    text.includes("i want to do") ||
    text.includes("i want to start") ||
    text.includes("help me start") ||
    text.includes("i want admin") ||
    text.includes("admin work") ||
    text.includes("writing work")
  );
}

async function detectAndStorePreferences(userId: string, input: string) {
  const lower = input.toLowerCase();
  const preferenceWrites: Array<Promise<void>> = [];
  const requestedCategory = detectRequestedCategory(lower);

  if (requestedCategory) {
    preferenceWrites.push(
      storeMemory({
        userId,
        type: "preference",
        content: `User prefers ${requestedCategory} jobs.`,
      })
    );
  }

  if (lower.includes("high paying") || lower.includes("above $") || lower.includes("$20")) {
    preferenceWrites.push(
      storeMemory({
        userId,
        type: "preference",
        content: "User prefers high-paying opportunities.",
      })
    );
  }

  if (lower.includes("upwork") || lower.includes("fiverr") || lower.includes("linkedin")) {
    preferenceWrites.push(
      storeMemory({
        userId,
        type: "preference",
        content: "User has platform preference context in conversation.",
      })
    );
  }

  await Promise.all(preferenceWrites);
}

async function runRuleBasedActions(userId: string, input: string): Promise<ConversationResult | null> {
  const lower = input.toLowerCase();
  const requestedCategory = detectRequestedCategory(lower);

  if (requestedCategory && isCareerStartIntent(lower)) {
    const onboardingReply = buildCareerOnboardingReply(requestedCategory);

    await storeMemory({
      userId,
      type: "strategy",
      content: `Career onboarding started for ${requestedCategory}.`,
      context: onboardingReply.metadata || {},
    });

    return onboardingReply;
  }

  if (lower.includes("find") && lower.includes("job")) {
    const jobs = await getTopJobMatches(userId, 0, 5);
    const foundCount = jobs.length;
    const focusLabel = requestedCategory ? `${requestedCategory}-focused` : "best-matching";

    await storeMemory({
      userId,
      type: "strategy",
      content: `Job discovery returned ${foundCount} ${focusLabel} opportunities.`,
      context: { count: foundCount, category: requestedCategory },
    });

    return {
      action: "fetch_jobs",
      reply: `I found ${foundCount} ${focusLabel} opportunities. Do you want me to apply?`,
      metadata: { foundCount, jobs, category: requestedCategory },
    };
  }

  if (lower.includes("apply") && (lower.includes("high paying") || lower.includes("above $20") || lower.includes("$20"))) {
    const applications = await autoApplyToJobs(userId);
    const appliedCount = applications.length;

    await storeMemory({
      userId,
      type: "strategy",
      content: `Auto-apply executed for high-paying jobs. Applied to ${appliedCount}.`,
      context: { appliedCount },
    });

    return {
      action: "auto_apply",
      reply: `Done. I applied to ${appliedCount} high-paying opportunities from your shortlist.`,
      metadata: { appliedCount },
    };
  }

  return null;
}

export async function runConversation({
  userId,
  input,
}: {
  userId: string;
  input: string;
}): Promise<ConversationResult> {
  // Check access first
  const hasAccess = await checkAccess(userId);
  if (!hasAccess) {
    return {
      action: "access_denied",
      reply: "Your access request is pending approval. Please contact support to proceed.",
      metadata: { access: false },
    };
  }

  const mode = await getUserMode(userId);
  const ambition = await getUserAmbition(userId);
  const goal = await getUserGoal(userId, "income");

  const modeSwitch = await handleVoiceCommandModeSwitch(input, userId);
  if (modeSwitch.changed) {
    await storeMemory({
      userId,
      type: "conversation",
      content: `User: ${input}\nAI: ${modeSwitch.reply}`,
      context: { action: "mode_switch", mode: modeSwitch.mode },
    });

    return {
      action: "mode_switch",
      reply: modeSwitch.reply,
      metadata: { mode: modeSwitch.mode },
    };
  }

  const recentConversation = await getRecentMemory(userId, "conversation", 5);
  const preferenceMemory = await getRecentMemory(userId, "preference", 5);
  const strategyMemory = await getRecentMemory(userId, "strategy", 5);

  const lastConversation = recentConversation[0];
  const lastState = resolveStateFromMemory(lastConversation);
  const newState = updateState(lastState, input);

  await detectAndStorePreferences(userId, input);

  const stateResult = await runStateFlow({
    userId,
    mode,
    state: newState,
  });

  if (stateResult) {
    await storeMemory({
      userId,
      type: "conversation",
      content: `User: ${input}\nAI: ${stateResult.reply}`,
      state: newState,
      context: {
        action: stateResult.action,
        mode,
        metadata: stateResult.metadata || {},
      },
    });

    return stateResult;
  }

  const ruleAction = await runRuleBasedActions(userId, input);
  if (ruleAction) {
    await storeMemory({
      userId,
      type: "conversation",
      content: `User: ${input}\nAI: ${ruleAction.reply}`,
      state: newState,
      context: {
        action: ruleAction.action,
        mode,
        metadata: ruleAction.metadata || {},
      },
    });

    return ruleAction;
  }

  const convoContext = recentConversation.map((m) => normalizeText(m.content)).join("\n");
  const prefContext = preferenceMemory.map((m) => normalizeText(m.content)).join("\n");
  const stratContext = strategyMemory.map((m) => normalizeText(m.content)).join("\n");

  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    const fallbackReply = "I am ready to help you earn. Tell me if you want job discovery, auto-apply, or earnings optimization.";

    await storeMemory({
      userId,
      type: "conversation",
      content: `User: ${input}\nAI: ${fallbackReply}`,
      state: newState,
      context: { action: detectAction(input), mode, source: "fallback" },
    });

    return {
      action: detectAction(input),
      reply: fallbackReply,
    };
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: openAIKey });

  // Generate strategy based on tier and ambition
  let strategyRole = "You are a proactive AI assistant focused on helping the user earn income efficiently.";
  let tierInfo = "";

  if (goal) {
    const tier = goal.current_tier;
    generateStrategyForTier(tier, ambition);
    const mindsetPrompt = generateMindsetPrompt(tier, ambition, goal.target_amount);
    strategyRole = mindsetPrompt;
    tierInfo = `\nCurrent goal tier: ${tier}\nTarget: $${goal.target_amount}\nProgress: $${goal.current_amount}/$${goal.target_amount}\nAmbition: ${ambition}`;
  }

  const prompt = [
    strategyRole,
    "Tone: friendly, motivational, professional, results-driven.",
    "When appropriate, ask follow-up questions and maintain multi-turn continuity.",
    `Operating mode: ${mode}. In assist mode, do not auto-execute sensitive actions. In autonomous mode, execute where possible and report results.`,
    tierInfo,
    "",
    "Recent conversation context:",
    convoContext || "none",
    "",
    "Preference memory:",
    prefContext || "none",
    "",
    "Strategic memory:",
    stratContext || "none",
    "",
    `User input: ${input}`,
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim() || "I am ready. Should I start with job discovery?";
  const action = detectAction(input);

  await storeMemory({
    userId,
    type: "conversation",
    content: `User: ${input}\nAI: ${reply}`,
    state: newState,
    context: { action, mode, source: "llm", ambition },
  });

  return {
    action,
    reply,
  };
}