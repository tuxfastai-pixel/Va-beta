export function detectTrustConcern(message: string) {
  const m = String(message || "").toLowerCase();

  if (
    m.includes("experience") ||
    m.includes("reference") ||
    m.includes("worked before") ||
    m.includes("portfolio")
  ) {
    return "proof_request";
  }

  if (m.includes("not sure") || m.includes("trust") || m.includes("reliable")) {
    return "trust_objection";
  }

  return null;
}
