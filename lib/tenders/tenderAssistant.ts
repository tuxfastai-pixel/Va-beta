export function analyzeTender(tender: { description?: string | null }) {
  const text = String(tender.description || "").toLowerCase();

  return {
    requiresAdmin: text.includes("admin"),
    requiresFinance: text.includes("financial"),
    requiresCompliance: text.includes("compliance"),
    duration: text.includes("12 months") ? "long" : "short",
  };
}