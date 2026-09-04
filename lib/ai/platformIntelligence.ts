export function computeFinalScore(score: number, confidence: number) {
  return score * confidence;
}

export function applyStability(
  previous: Record<string, number>,
  current: Record<string, number>
) {
  const result: Record<string, number> = {};

  for (const key of Object.keys(current)) {
    result[key] = previous[key] != null
      ? previous[key] * 0.7 + current[key] * 0.3
      : current[key];
  }

  return result;
}
