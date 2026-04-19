/**
 * Retainer Detection & Conversion Engine
 * Identifies jobs/clients with retainer potential and generates pitches
 */

export interface RetainerSignal {
  is_retainer: boolean;
  probability: number;
  signals_matched: string[];
}

const RETAINER_SIGNALS = [
  "ongoing",
  "long-term",
  "monthly",
  "support",
  "management",
  "assistant",
  "recurring",
  "weekly",
  "consistent",
  "regular basis",
  "indefinitely",
  "maintain",
  "retainer",
];

/**
 * Analyse job description for retainer potential signals
 */
export function detectRetainerOpportunity(job: { description?: string; title?: string }): RetainerSignal {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();

  const matched = RETAINER_SIGNALS.filter((s) => text.includes(s));
  const probability = Math.min(1, matched.length / 4); // cap at 1.0

  return {
    is_retainer: probability > 0.3,
    probability,
    signals_matched: matched,
  };
}

/**
 * Estimate monthly retainer value from a one-off job rate
 */
export function estimateRetainerValue(job: { pay_amount?: number }): number | null {
  if (!job.pay_amount) return null;
  // Baseline: assume 3 similar tasks per month at 80% of original rate
  return Math.round(job.pay_amount * 3 * 0.8);
}

/**
 * Generate a polite retainer conversion pitch message
 */
export function generateRetainerPitch(clientName?: string): string {
  const greeting = clientName ? `Hi ${clientName},` : "Hi,";
  return `${greeting}

I've really enjoyed working on this project with you.

To make things more efficient on your side, I can support you on an ongoing basis — so you don't have to create a new task each time.

A simple monthly arrangement would give you consistent, reliable support without the back-and-forth of one-off hiring.

Would you like me to put together a short monthly plan? Happy to keep it flexible.

Looking forward to hearing from you 👍`;
}

/**
 * Generate an upsell message for expanding an existing project
 */
export function generateUpsellMessage(clientName?: string, context?: string): string {
  const greeting = clientName ? `Hi ${clientName},` : "Hi,";
  const contextLine = context ? `I noticed we're making great progress on ${context}.` : "Things are looking great.";
  return `${greeting}

${contextLine}

I have some ideas on how we could expand the scope to deliver even more value for you — whether that's taking over a related area, improving the workflow, or handling additional tasks.

Would you be open to a quick conversation about upgrading this into a fuller package?`;
}

/**
 * Generate a low-touch re-engagement message for dormant clients
 */
export function generateReEngagementMessage(clientName?: string): string {
  const greeting = clientName ? `Hi ${clientName},` : "Hi,";
  return `${greeting}

Just checking in — I hope things are going well on your end.

If you ever need help again, I'm available and happy to jump back in 👍`;
}
