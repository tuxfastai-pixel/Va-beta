import { enforceContextualHonesty } from "@/lib/assist/contextualHonestyLayer";

export interface LiveAssistInput {
  userMessage: string;
  meetingStage?: "intro" | "discovery" | "objection" | "negotiation" | "close";
  intent?: "interview" | "sales_call" | "client_call" | "tender_meeting" | "general";
  confidenceLevel?: number;
  identityContext?: {
    activeIdentity: string;
    primaryResumeVariant?: string;
    terminology?: string[];
    workflowPriorities?: string[];
  };
}

export function runLiveAssistEngine(input: LiveAssistInput) {
  const stage = input.meetingStage || "discovery";
  const intent = input.intent || "general";
  const confidence = Math.max(0, Math.min(1, Number(input.confidenceLevel || 0.6)));

  const baseSuggestion =
    stage === "intro"
      ? "Open with a concise value statement, then ask one diagnostic question."
      : stage === "objection"
        ? "Acknowledge concern, restate requirement, and propose a low-risk next step."
        : stage === "negotiation"
          ? "Anchor to outcomes, not effort hours; propose two scope options."
          : "Clarify goals, timeline, and expected business result before committing details.";

  const identityTerms = (input.identityContext?.terminology || []).slice(0, 4);
  const identityWorkflow = (input.identityContext?.workflowPriorities || []).slice(0, 3);
  const identityPrompt = input.identityContext
    ? ` Keep the answer aligned to ${input.identityContext.activeIdentity}${input.identityContext.primaryResumeVariant ? ` (${input.identityContext.primaryResumeVariant})` : ""}.`
    : "";

  const enrichedSuggestion = `${baseSuggestion}${identityPrompt}`.trim();
  const honesty = enforceContextualHonesty({ proposedText: enrichedSuggestion });

  const workflowHints = identityWorkflow.length > 0
    ? identityWorkflow
    : [
        "Capture key requirement in one sentence.",
        "Confirm deadline and success criteria.",
        "Close with explicit next action and owner.",
      ];

  return {
    intent,
    stage,
    confidenceGuidance: confidence < 0.45 ? "Slow pace, ask one question at a time, and confirm understanding." : "Maintain pace and summarize agreed actions clearly.",
    answerSuggestion: honesty.sanitizedText,
    terminologyPriority: identityTerms,
    workflowHints,
    honesty,
  };
}
