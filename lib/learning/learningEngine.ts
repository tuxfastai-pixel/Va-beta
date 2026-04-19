import { supabaseServer } from "@/lib/supabaseServer";

export type LearningEvent = {
  id?: string;
  user_id?: string | null;
  event_type: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type AgentMemory = {
  best_proposal_style?: string;
  best_job_type?: string;
  avoid?: string[];
};

function isMissingTable(error: { message?: string } | null | undefined, table: string) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(table.toLowerCase()) && (message.includes("could not find the table") || message.includes("does not exist"));
}

function isMissingProfileAIMemoryColumn(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("profiles.ai_memory") || (message.includes("ai_memory") && message.includes("profiles") && message.includes("does not exist"));
}

export async function recordEvent(userId: string, type: string, data: Record<string, unknown> = {}) {
  const payload = {
    user_id: userId,
    event_type: type,
    metadata: data,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseServer.from("learning_events").insert(payload);

  if (error && !isMissingTable(error, "learning_events")) {
    throw new Error(`Failed to record learning event for ${userId}: ${error.message}`);
  }

  return {
    ...payload,
    persisted: !error,
  };
}

export async function getLearningEvents(userId: string) {
  const { data, error } = await supabaseServer
    .from("learning_events")
    .select("event_type, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error && !isMissingTable(error, "learning_events")) {
    throw new Error(`Failed to load learning events for ${userId}: ${error.message}`);
  }

  return ((data || []) as LearningEvent[]);
}

export function analyzePerformance(events: LearningEvent[]) {
  const wins = events.filter((event) => event.event_type === "job_won").length;
  const losses = events.filter((event) => event.event_type === "job_lost").length;
  const replies = events.filter((event) => event.event_type === "client_reply").length;
  const proposals = events.filter((event) => event.event_type === "proposal_sent").length;

  const winRate = wins / (wins + losses || 1);
  const engagementRate = replies / (proposals || 1);

  return {
    wins,
    losses,
    replies,
    proposals,
    winRate,
    engagementRate,
    recommendation:
      winRate < 0.3
        ? "Improve proposals and target lower-competition jobs"
        : "Scale applications toward higher-paying low-competition jobs",
    strategy: winRate < 0.3 ? "low competition jobs" : "scale applications",
    proposalStyle: engagementRate < 0.25 ? "more detailed" : "friendly",
  };
}

export async function getProfileAIMemory(userId: string): Promise<AgentMemory> {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("ai_memory")
    .eq("id", userId)
    .maybeSingle();

  if (error && !isMissingProfileAIMemoryColumn(error)) {
    throw new Error(`Failed to load profile AI memory for ${userId}: ${error.message}`);
  }

  if (!data || error || typeof data.ai_memory !== "object" || data.ai_memory === null) {
    return {
      best_proposal_style: "friendly",
      best_job_type: "data entry",
      avoid: ["high competition jobs"],
    };
  }

  return data.ai_memory as AgentMemory;
}

export async function updateProfileAIMemory(userId: string, memoryPatch: AgentMemory) {
  const currentMemory = await getProfileAIMemory(userId);
  const nextMemory = {
    ...currentMemory,
    ...memoryPatch,
    avoid: Array.from(new Set([...(currentMemory.avoid || []), ...(memoryPatch.avoid || [])])),
  };

  const { error } = await supabaseServer
    .from("profiles")
    .update({ ai_memory: nextMemory })
    .eq("id", userId);

  if (error && !isMissingProfileAIMemoryColumn(error)) {
    throw new Error(`Failed to update profile AI memory for ${userId}: ${error.message}`);
  }

  return {
    ...nextMemory,
    persisted: !error,
  };
}
