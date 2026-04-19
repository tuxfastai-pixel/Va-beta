import { supabaseServer } from "@/lib/supabaseServer";
import type { AgentResult } from "./agentTypes";

async function logError(error: unknown, payload: unknown, attempt: number) {
  const message = error instanceof Error ? error.message : "Unknown agent error";

  const { error: insertError } = await supabaseServer.from("orchestrator_logs").insert({
    state: "error",
    action: "agent_failure",
    result: {
      message,
      payload,
      attempt,
    },
    created_at: new Date().toISOString(),
  });

  if (insertError && !String(insertError.message || "").toLowerCase().includes("orchestrator_logs")) {
    console.error(`Failed to log agent error: ${insertError.message}`);
  }
}

export async function safeRun<TPayload, TData>(
  agentFn: (payload: TPayload) => Promise<AgentResult<TData>>,
  payload: TPayload,
  retries = 3
): Promise<AgentResult<TData>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await agentFn(payload);

      if (!result.success) {
        throw new Error(result.feedback || "Agent failed");
      }

      return result;
    } catch (error) {
      lastError = error;
      await logError(error, payload, attempt);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Agent failed after retries";
  return {
    success: false,
    confidence: 0,
    feedback: message,
  };
}
