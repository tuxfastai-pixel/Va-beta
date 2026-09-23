export function qualifyLead(message: string) {
  const m = String(message || "").toLowerCase();

  let score = 0;
  if (m.includes("urgent") || m.includes("asap")) score += 3;
  if (m.includes("budget") || m.includes("price")) score += 2;
  if (m.includes("long term")) score += 2;
  if (m.includes("hire") || m.includes("need someone")) score += 3;

  return score;
}
