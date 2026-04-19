import { confidenceScore, humanize, validateOutput } from "@/lib/ai/outputQuality";
import { generateWinningProposal, suggestProposalTone, type ProposalTone } from "@/lib/jobs/winningProposal";
import { getProfileAIMemory } from "@/lib/learning/learningEngine";
import type { AgentResult } from "./agentTypes";

type JobLike = Record<string, unknown>;
type UserLike = {
  id?: string;
  user_id?: string;
  skills?: string[] | string | null;
};

function resolveUserId(user: UserLike) {
  return String(user.id || user.user_id || "").trim();
}

function pickTone(memoryTone: string | undefined, fallbackTone: ProposalTone): ProposalTone {
  if (memoryTone === "professional" || memoryTone === "friendly" || memoryTone === "assertive") {
    return memoryTone;
  }

  return fallbackTone;
}

export async function proposalAgent(job: JobLike, user: UserLike): Promise<AgentResult<string>> {
  const userId = resolveUserId(user);
  const memory = userId ? await getProfileAIMemory(userId) : { best_proposal_style: undefined };
  const tone = pickTone(memory.best_proposal_style, suggestProposalTone(job));
  let proposal = await generateWinningProposal(job, user, tone);
  proposal = humanize(proposal);

  const validation = await validateOutput(proposal);
  const score = confidenceScore(proposal);

  return {
    success: score > 60 && validation.passed,
    data: proposal,
    confidence: Math.max(0.1, Math.min(1, score / 100)),
    feedback: score > 80 && validation.passed ? "High-conversion proposal ready." : "Proposal generated but should be reviewed for stronger positioning.",
  };
}
