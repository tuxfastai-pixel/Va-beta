export interface RealtimeKnowledgeInput {
  domain?: string;
  query?: string;
}

const KNOWLEDGE: Record<string, string[]> = {
  crm: [
    "Lead status hygiene improves conversion visibility.",
    "Use SLA timers to enforce response discipline.",
    "Track source and stage movement weekly.",
  ],
  operations: [
    "Define owner, timeline, and success metric for each task.",
    "Use escalation paths for blockers older than 24h.",
    "Close loops with written confirmation.",
  ],
  finance: [
    "Reconciliation should include exception logs.",
    "Audit readiness requires traceable change notes.",
    "Separate approval and execution where possible.",
  ],
};

export function runRealtimeKnowledgeEngine(input: RealtimeKnowledgeInput) {
  const domain = String(input.domain || "operations").toLowerCase();
  const notes = KNOWLEDGE[domain] || KNOWLEDGE.operations;

  return {
    domain,
    query: input.query || "",
    notes,
    formulas: [
      "callback_rate = callbacks / proposals",
      "conversion_rate = wins / proposals",
      "salary_lift_pct = (new - baseline) / baseline * 100",
    ],
  };
}
