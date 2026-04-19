import { humanize, validateOutput } from "@/lib/ai/outputQuality";
import { executeTask } from "@/lib/agents/taskExecutor";
import type { AgentResult } from "./agentTypes";

export async function executionAgent(task: { description?: string }): Promise<AgentResult<string | null>> {
  const rawResult = await executeTask(task);
  const result = humanize(String(rawResult || ""));
  const validation = await validateOutput(result);

  return {
    success: validation.passed,
    data: result || null,
    confidence: 0.9,
    feedback: "Execution task completed through the specialized worker.",
  };
}
