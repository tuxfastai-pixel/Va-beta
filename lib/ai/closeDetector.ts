export function detectCloseIntent(message: string) {
  const m = String(message || "").toLowerCase();

  if (m.includes("let's start") || m.includes("when can you begin") || m.includes("okay do it")) {
    return true;
  }

  return false;
}

export function buildCloseResponse(firstStep: string) {
  return [
    "Great - I will get started right away.",
    "",
    `I will begin with ${firstStep} and keep you updated.`,
  ].join("\n");
}
