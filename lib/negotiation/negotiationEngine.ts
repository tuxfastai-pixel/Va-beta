import { askSmartQuestion, closeDeal, handlePriceObjection, handleTrustObjection, trustReply } from "@/lib/psychology/conversionPsychology";
import { buildTrustResponse, localizeTrustResponse } from "@/lib/ai/trustResponder";
import { detectTrustConcern } from "@/lib/ai/trustTrigger";
import { attachPortfolio } from "@/lib/ai/autoTrustLink";
import { buildCloseResponse, detectCloseIntent } from "@/lib/ai/closeDetector";
import { generatePlatformResponse } from "@/lib/ai/platformResponder";
import { resolveScenario } from "@/lib/ai/conversationTrainer";

export type NegotiationScenario =
  | "price_push"
  | "hesitation"
  | "competition"
  | "ready_to_close"
  | "general";

export type ConversationStage = "inquiry" | "value" | "trust" | "close";

export function detectNegotiationScenario(message: string): NegotiationScenario {
  const m = String(message || "").toLowerCase();

  if (m.includes("too expensive") || m.includes("budget") || m.includes("price")) {
    return "price_push";
  }

  if (m.includes("need time") || m.includes("think")) {
    return "hesitation";
  }

  if (m.includes("another freelancer") || m.includes("someone else")) {
    return "competition";
  }

  if (m.includes("ok") || m.includes("let's proceed") || m.includes("lets proceed") || m.includes("go ahead")) {
    return "ready_to_close";
  }

  return "general";
}

export function getConversationStage(message: string): ConversationStage {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("price") || normalized.includes("budget") || normalized.includes("cost")) {
    return "trust";
  }

  if (normalized.includes("experience") || normalized.includes("portfolio") || normalized.includes("worked on")) {
    return "value";
  }

  if (normalized.includes("proceed") || normalized.includes("start") || normalized.includes("send invoice")) {
    return "close";
  }

  return "inquiry";
}

type ClientMessageOptions = {
  clientReady?: boolean;
};

export function handleClientMessage(message: string, options: ClientMessageOptions = {}) {
  const normalized = String(message || "").toLowerCase();
  const stage = getConversationStage(message);
  const trustTrigger = detectTrustConcern(message);
  const closeIntent = detectCloseIntent(message);
  const trainedScenario = resolveScenario(message);

  if (trustTrigger) {
    const trustReplyText = buildTrustResponse(trustTrigger);
    if (trustReplyText) {
      return attachPortfolio(localizeTrustResponse(trustReplyText, "GLOBAL"));
    }
  }

  if (closeIntent) {
    return buildCloseResponse("inbox setup and follow-up structure");
  }

  if (trainedScenario) {
    return trainedScenario.response;
  }

  if (options.clientReady || stage === "close") {
    return closeDeal();
  }

  if (normalized.includes("price") || normalized.includes("budget")) {
    return `${handlePriceObjection()}\n\n${askSmartQuestion({ optionA: "a focused version", optionB: "a full-scope version" })}`;
  }

  if (normalized.includes("experience") || normalized.includes("worked on") || normalized.includes("portfolio")) {
    return `${trustReply()}\n\n${askSmartQuestion({ optionA: "a quick win first", optionB: "the full delivery plan" })}`;
  }

  if (stage === "trust") {
    return `${handleTrustObjection()}\n\n${askSmartQuestion({ optionA: "daily updates", optionB: "milestone updates" })}`;
  }

  return `${trustReply()}\n\n${askSmartQuestion({ optionA: "priority delivery", optionB: "standard delivery" })}`;
}

export function generateNegotiationReply(
  scenario: NegotiationScenario,
  _job: Record<string, unknown>
): string {
  const jobSummary = String(_job.title || _job.description || "this work");
  const platformResponse = generatePlatformResponse(String(_job.platform || ""), _job);

  switch (scenario) {
    case "price_push":
      return `${handlePriceObjection()}\n\nI can also adjust scope around ${jobSummary} while keeping the core outcome strong.\n\n${askSmartQuestion({ optionA: "must-have deliverables", optionB: "extended deliverables" })}`;

    case "hesitation":
      return `${handleTrustObjection()}\n\nTo make the decision easier, I can start quickly on ${jobSummary} and keep everything structured and low-risk.`;

    case "competition":
      return `${trustReply()}\n\nWhat I bring is consistent execution, fast turnaround, and reliable communication so you do not have to manage rework later.`;

    case "ready_to_close":
      return `${closeDeal()}\n\n${buildCloseResponse("the first priority task")}`;

    default:
      return `${platformResponse}\n\n${handleClientMessage(String(_job.description || "general inquiry"), { clientReady: false })}`;
  }
}
