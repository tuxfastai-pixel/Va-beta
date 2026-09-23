export function allocateEffort(scores: Record<string, number>) {
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const allocation: Record<string, number> = {};

  for (const [career, score] of Object.entries(scores)) {
    allocation[career] = total > 0 ? score / total : 0;
  }

  return allocation;
}
