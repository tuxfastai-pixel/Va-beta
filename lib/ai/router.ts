export function routeLead(_message: string, score: number) {
  if (score >= 6) return "book_call";
  if (score >= 3) return "engage";
  return "nurture";
}
