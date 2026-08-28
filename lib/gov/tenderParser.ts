export type TenderInput = {
  id?: string | number;
  title?: string | null;
  description?: string | null;
  department?: string | null;
  closingDate?: string | null;
};

export function parseTender(tender: TenderInput) {
  const text = String(tender.description || "").toLowerCase();

  return {
    id: tender.id,
    title: tender.title,
    department: tender.department,
    closingDate: tender.closingDate,
    tags: [
      text.includes("admin") && "admin",
      text.includes("data capturing") && "data",
      text.includes("bookkeeping") && "finance",
      text.includes("compliance") && "compliance",
    ].filter(Boolean) as string[],
    valueScore: text.includes("12 months") ? 5 : text.includes("contract") ? 4 : 2,
  };
}

export function scoreTender(tender: { tags: string[]; valueScore?: number }) {
  let score = 0;

  if (tender.tags.includes("finance")) score += 5;
  if (tender.tags.includes("admin")) score += 3;
  if (tender.valueScore) score += tender.valueScore;

  return score;
}

export function shouldAutoApplyTender() {
  return false;
}
