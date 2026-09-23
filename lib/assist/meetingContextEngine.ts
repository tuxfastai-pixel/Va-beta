export interface MeetingSignalInput {
  transcript?: string;
  stageHint?: string;
}

export function deriveMeetingContext(input: MeetingSignalInput) {
  const text = String(input.transcript || "").toLowerCase();

  const stage = input.stageHint
    || (text.includes("price") || text.includes("budget") ? "negotiation"
      : text.includes("concern") || text.includes("risk") ? "objection"
      : text.includes("introduce") || text.includes("about yourself") ? "intro"
      : "discovery");

  const intent = text.includes("tender") ? "tender_meeting"
    : text.includes("interview") ? "interview"
      : text.includes("client") ? "client_call"
        : text.includes("sales") ? "sales_call"
          : "general";

  const riskSignals = ["deadline pressure", "scope ambiguity", "pricing resistance"].filter((signal) => text.includes(signal.split(" ")[0]));

  return {
    stage,
    intent,
    employerIntent: text.includes("long-term") ? "long_term_relationship" : "transactional_or_unclear",
    riskSignals,
    negotiationOpportunities: text.includes("budget") || text.includes("scope") ? ["Offer phased delivery options"] : [],
  };
}
