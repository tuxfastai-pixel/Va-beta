export function checkDeadlines(tenders: Array<{ deadline: string | Date }>) {
  const now = new Date();

  return tenders.filter((tender) => {
    const diff = (new Date(tender.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 2;
  });
}