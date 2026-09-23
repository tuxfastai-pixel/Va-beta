export function allocatePlatforms(scores: Record<string, number>) {
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const allocation: Record<string, number> = {};

  for (const [platform, score] of Object.entries(scores)) {
    let value = total > 0 ? score / total : 0;

    if (value < 0.1) {
      value = 0.1;
    }

    if (value > 0.7) {
      value = 0.7;
    }

    allocation[platform] = value;
  }

  const normalizedTotal = Object.values(allocation).reduce((sum, score) => sum + score, 0);
  if (normalizedTotal > 0) {
    for (const key of Object.keys(allocation)) {
      allocation[key] = allocation[key] / normalizedTotal;
    }
  }

  return allocation;
}

export function isNewPlatform(platform: string, known: string[]) {
  return !known.includes(platform);
}
