export type Scenario =
  | "price_push"
  | "hesitation"
  | "comparison"
  | "ready_to_close";

type JobLike = {
  pay_amount?: number | string | null;
};

export function generateClosingReply(scenario: Scenario, job: JobLike) {
  switch (scenario) {
    case "price_push":
      return `
I understand keeping costs efficient.

The focus here is getting this done correctly the first time, which saves time and cost overall.

I can proceed at $${job.pay_amount ?? "TBD"} and deliver a reliable result quickly.
`;

    case "hesitation":
      return `
Completely understand - timing and clarity matter.

If helpful, I can start with a small portion so you can see the quality before committing further.
`;

    case "comparison":
      return `
That makes sense.

What usually matters most here is reliability and turnaround.

I focus on clean execution and fast delivery, which tends to make the biggest difference.
`;

    case "ready_to_close":
      return `
Great - I can get started immediately.

I'll begin with the core task and keep you updated as I progress.
`;

    default:
      return "Happy to proceed - let me know how you'd like to move forward.";
  }
}

export function detectScenario(message: string): Scenario {
  const text = String(message || "").toLowerCase();

  if (text.includes("price") || text.includes("budget")) return "price_push";
  if (text.includes("thinking") || text.includes("decide")) return "hesitation";
  if (text.includes("others") || text.includes("comparing")) return "comparison";
  if (
    text.includes("go ahead") ||
    text.includes("start") ||
    text.includes("let's proceed") ||
    text.includes("lets proceed") ||
    text.includes("proceed")
  ) {
    return "ready_to_close";
  }

  return "hesitation";
}
