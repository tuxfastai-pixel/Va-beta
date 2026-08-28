import { generateAnswer } from "@/lib/interview/interviewEngine";
import { handlePricePushback, respondToClosing, type ClosingContext } from "@/lib/closing/closingEngine";
import type { InterviewContext } from "@/lib/interview/interviewEngine";

export type ConversationStage = "interview" | "negotiation" | "closing" | "general" | "followup";

export interface ConversationState {
  stage: ConversationStage;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  context: {
    interview?: InterviewContext;
    closing?: ClosingContext;
    negotiation?: { budget?: number; scope?: string };
  };
  metadata: {
    startedAt: Date;
    lastMessageAt: Date;
    totalMessages: number;
  };
}

/**
 * Determine conversation stage from message content
 */
export function getStage(message: string): ConversationStage {
  const lower = message.toLowerCase();

  // Interview indicators
  if (
    lower.includes("interview") ||
    lower.includes("question") ||
    lower.includes("tell me about") ||
    lower.includes("describe")
  ) {
    return "interview";
  }

  // Negotiation indicators
  if (
    lower.includes("price") ||
    lower.includes("budget") ||
    lower.includes("cost") ||
    lower.includes("rate") ||
    lower.includes("scope")
  ) {
    return "negotiation";
  }

  // Closing indicators
  if (
    lower.includes("next step") ||
    lower.includes("start") ||
    lower.includes("proceed") ||
    lower.includes("agreement") ||
    lower.includes("contract")
  ) {
    return "closing";
  }

  return "general";
}

/**
 * Route message to appropriate handler based on stage
 */
export function respond(
  message: string,
  state: ConversationState
): { response: string; nextStage: ConversationStage } {
  const stage = getStage(message);

  if (stage === "interview" && state.context.interview) {
    return {
      response: generateAnswer(message, state.context.interview),
      nextStage: "interview",
    };
  }

  if (stage === "negotiation") {
    return {
      response: handleNegotiation(message, state.context.negotiation),
      nextStage: "negotiation",
    };
  }

  if (stage === "closing" && state.context.closing) {
    const { response } = respondToClosing(message, state.context.closing);
    return {
      response,
      nextStage: "closing",
    };
  }

  return {
    response: generateGeneralResponse(message),
    nextStage: "general",
  };
}

/**
 * Handle negotiation messages
 */
function handleNegotiation(
  message: string,
  context?: { budget?: number; scope?: string }
): string {
  return handlePricePushback(context?.budget || 0, {
    budget: context?.budget,
    scope: context?.scope,
  });
}

/**
 * Generate general response for unclassified messages
 */
function generateGeneralResponse(message: string): string {
  const templates = [
    `Thanks for that. I appreciate you sharing more context. Happy to help.`,
    `That's good to know. I'm here to support you on this.`,
    `Understood. Let me work on that and get back to you.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Initialize conversation state
 */
export function initializeConversationState(context?: {
  interview?: InterviewContext;
  closing?: ClosingContext;
}): ConversationState {
  return {
    stage: "general",
    history: [],
    context: {
      interview: context?.interview,
      closing: context?.closing,
    },
    metadata: {
      startedAt: new Date(),
      lastMessageAt: new Date(),
      totalMessages: 0,
    },
  };
}

/**
 * Update conversation state with new message
 */
export function updateConversationState(
  state: ConversationState,
  userMessage: string,
  assistantResponse: string
): ConversationState {
  const stage = getStage(userMessage);

  return {
    ...state,
    stage,
    history: [
      ...state.history,
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantResponse },
    ],
    metadata: {
      ...state.metadata,
      lastMessageAt: new Date(),
      totalMessages: state.metadata.totalMessages + 1,
    },
  };
}

/**
 * Get summary of conversation progress
 */
export function getConversationSummary(state: ConversationState): {
  stage: ConversationStage;
  messageCount: number;
  duration: number;
  canClose: boolean;
} {
  const duration =
    new Date().getTime() - state.metadata.startedAt.getTime();

  return {
    stage: state.stage,
    messageCount: state.metadata.totalMessages,
    duration,
    canClose: state.stage === "closing" && state.metadata.totalMessages >= 3,
  };
}

/**
 * Detect stage transition opportunities
 */
export function suggestStageTransition(state: ConversationState): ConversationStage | null {
  // After interview, move to negotiation
  if (state.stage === "interview" && state.metadata.totalMessages >= 4) {
    return "negotiation";
  }

  // After negotiation, move to closing
  if (state.stage === "negotiation" && state.metadata.totalMessages >= 6) {
    return "closing";
  }

  return null;
}
