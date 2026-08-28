export const scenarios = [
  {
    type: "price",
    response:
      "I understand. The goal is to take this completely off your plate and keep things running consistently. We can start with a smaller scope first and scale once you are comfortable.",
  },
  {
    type: "trust",
    response:
      "Good question. I focus on structured workflows - managing tasks, handling follow-ups, and keeping everything organized so nothing slips through. Happy to start with a small task so you can see how I work.",
  },
  {
    type: "urgent",
    response:
      "I can prioritize this and start with key tasks immediately. I can begin right away.",
  },
] as const;

export function resolveScenario(message: string) {
  const lower = String(message || "").toLowerCase();

  if (lower.includes("expensive") || lower.includes("budget")) return scenarios[0];
  if (lower.includes("experience") || lower.includes("trust")) return scenarios[1];
  if (lower.includes("asap") || lower.includes("urgent")) return scenarios[2];

  return null;
}
