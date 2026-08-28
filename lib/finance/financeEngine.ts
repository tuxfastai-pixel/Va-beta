type FinanceJobLike = {
  description?: string | null;
};

const keywords = [
  "vat",
  "sars",
  "bookkeeping",
  "reconciliation",
  "audit",
  "invoices",
  "payroll",
];

export function detectFinanceJob(job: FinanceJobLike) {
  const text = String(job.description || "").toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}

export function getFinanceKeywords() {
  return [...keywords];
}
