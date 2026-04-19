import { humanize, validateOutput } from "@/lib/ai/outputQuality";
import { handleClientMessage } from "@/lib/negotiation/negotiationEngine";
import type { AgentResult } from "./agentTypes";

export async function conversationAgent(message: string, clientReady = false): Promise<AgentResult<string>> {
  const reply = humanize(handleClientMessage(message, { clientReady }));
  const validation = await validateOutput(reply);

  return {
    success: validation.passed,
    data: reply,
    confidence: clientReady ? 0.92 : 0.85,
    feedback: clientReady ? "Close trigger activated." : "Strategic client reply prepared.",
  };
}
