import { askSmartQuestion, closeDeal, handlePriceObjection, handleTrustObjection, trustReply } from "@/lib/psychology/conversionPsychology";

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

  switch (scenario) {
    case "price_push":
      return `${handlePriceObjection()}\n\nI can also adjust scope around ${jobSummary} while keeping the core outcome strong.\n\n${askSmartQuestion({ optionA: "must-have deliverables", optionB: "extended deliverables" })}`;

    case "hesitation":
      return `${handleTrustObjection()}\n\nTo make the decision easier, I can start quickly on ${jobSummary} and keep everything structured and low-risk.`;

    case "competition":
      return `${trustReply()}\n\nWhat I bring is consistent execution, fast turnaround, and reliable communication so you do not have to manage rework later.`;

    case "ready_to_close":
      return closeDeal();

    default:
      return handleClientMessage(String(_job.description || "general inquiry"), { clientReady: false });
  }
}
