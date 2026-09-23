export interface ClosingContext {
  clientName?: string;
  jobTitle?: string;
  budget?: number;
  scope?: string;
}

/**
 * Generate initial closing message
 * Soft close approach: confidence without pressure
 */
export function generateClosingMessage(context: ClosingContext): string {
  const prefix = context.clientName
    ? `Hi ${context.clientName},\n\n`
    : "Hi,\n\n";

  return (
    prefix +
    `I'm ready to get started on ${context.jobTitle || "this project"} and can begin immediately.\n\n` +
    `Based on the scope, I suggest we start with the core deliverables and scale as needed. This approach lets us validate results early and adjust if necessary.\n\n` +
    `I'm confident this will deliver the outcomes you're looking for.\n\n` +
    `Let me know how you'd like to proceed.`
  );
}

/**
 * Handle price objections with value-first strategy
 * Emphasize value before adjusting scope
 */
export function handlePricePushback(price: number, context?: ClosingContext): string {
  return (
    `I understand budget constraints.\n\n` +
    `Here's how I see it: the value I deliver typically justifies the investment.\n\n` +
    `That said, we have flexibility:\n` +
    `• Adjust scope to fit your budget while still delivering core results\n` +
    `• Start with phase 1 at a lower rate, then scale once you see results\n` +
    `• Structure as retainer if you prefer predictable costs\n\n` +
    `What matters most to you right now?`
  );
}

/**
 * Generate scope negotiation response
 */
export function handleScopeNegotiation(
  originalScope: string,
  proposedScope: string,
  context?: ClosingContext
): string {
  return (
    `I appreciate the feedback on scope.\n\n` +
    `Let me be clear: ${proposedScope}\n\n` +
    `This ensures we deliver the highest-impact items first. We can always expand into the other areas once those are complete and validated.\n\n` +
    `Does that work for you?`
  );
}

/**
 * Generate urgency-driven close
 * Use when client shows buying signals
 */
export function generateUrgencyClose(context: ClosingContext): string {
  return (
    `Great—sounds like we're aligned.\n\n` +
    `I have availability to start ${context.jobTitle ? `the ${context.jobTitle}` : "this project"} immediately.\n\n` +
    `Let's lock in the details and I can begin within 24 hours.\n\n` +
    `When works best to finalize?`
  );
}

/**
 * Generate risk mitigation close
 * Use when client is hesitant or worried
 */
export function generateRiskMitigationClose(context: ClosingContext): string {
  return (
    `I get why you're being careful. Here's how we reduce risk:\n\n` +
    `• Start with a small deliverable so you see quality upfront\n` +
    `• Clear milestones with payment tied to completion\n` +
    `• Weekly check-ins so we stay aligned\n\n` +
    `This way, you're not taking a big bet—you're testing first.\n\n` +
    `Can we start there?`
  );
}

/**
 * Detect closing readiness from message
 */
export function detectClosingSignal(message: string): boolean {
  const signals = [
    "let's start",
    "let's do it",
    "when can you start",
    "okay",
    "sounds good",
    "i'm in",
    "let's work together",
    "how soon",
    "what's next",
    "let's move forward",
    "proceed",
    "let's begin",
    "ready to go",
  ];

  const lower = message.toLowerCase();
  return signals.some((signal) => lower.includes(signal));
}

/**
 * Detect objections that need handling
 */
export function detectObjection(message: string): "price" | "scope" | "timing" | "risk" | null {
  const lower = message.toLowerCase();

  if (
    lower.includes("expensive") ||
    lower.includes("budget") ||
    lower.includes("cost") ||
    lower.includes("price") ||
    lower.includes("affordable") ||
    lower.includes("too much")
  ) {
    return "price";
  }

  if (
    lower.includes("scope") ||
    lower.includes("included") ||
    lower.includes("deliverable") ||
    lower.includes("what's involved")
  ) {
    return "scope";
  }

  if (
    lower.includes("timeline") ||
    lower.includes("how long") ||
    lower.includes("when") ||
    lower.includes("timing") ||
    lower.includes("rush")
  ) {
    return "timing";
  }

  if (
    lower.includes("risk") ||
    lower.includes("worried") ||
    lower.includes("guarantee") ||
    lower.includes("comfortable")
  ) {
    return "risk";
  }

  return null;
}

/**
 * Route to appropriate closing handler
 */
export function respondToClosing(
  message: string,
  context: ClosingContext
): {
  type: "close" | "objection_handler" | "acknowledgment";
  response: string;
} {
  if (detectClosingSignal(message)) {
    return {
      type: "close",
      response: generateUrgencyClose(context),
    };
  }

  const objection = detectObjection(message);

  if (objection === "price") {
    return {
      type: "objection_handler",
      response: handlePricePushback(context.budget || 0, context),
    };
  }

  if (objection === "risk") {
    return {
      type: "objection_handler",
      response: generateRiskMitigationClose(context),
    };
  }

  return {
    type: "acknowledgment",
    response: `Thanks for that. Let me address your concern...`,
  };
}
