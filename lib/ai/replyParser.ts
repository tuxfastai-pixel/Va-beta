export type ReplyType =
  | "price_objection"
  | "trust_objection"
  | "ready_to_close"
  | "meeting_request"
  | "general";

export function classifyReply(message: string): ReplyType {
  const lower = String(message || "").toLowerCase();

  if (lower.includes("price") || lower.includes("budget")) {
    return "price_objection";
  }

  if (lower.includes("not sure") || lower.includes("concern")) {
    return "trust_objection";
  }

  if (lower.includes("let's proceed") || lower.includes("lets proceed") || lower.includes("start")) {
    return "ready_to_close";
  }

  if (lower.includes("schedule") || lower.includes("call")) {
    return "meeting_request";
  }

  return "general";
}
