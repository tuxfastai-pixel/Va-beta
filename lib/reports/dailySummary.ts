export function buildDailySummary({
  jobs,
  tenders,
  revenue,
}: {
  jobs: Array<{ title?: string }>;
  tenders: Array<{ title?: string }>;
  revenue: number;
}) {
  return `
DAILY SUMMARY

Jobs Found: ${jobs.length}
Tenders Found: ${tenders.length}
Revenue Today: R${revenue}

Top Job:
${jobs[0]?.title || "None"}

Urgent Tenders:
${tenders.slice(0, 3).map((tender) => tender.title).join("\n") || "None"}

Action:
Check dashboard and respond to high-score opportunities.
`;
}