export interface HumanRealismVariant {
  key: string;
  headline: string;
  summary: string;
  keywords: string[];
}

export interface HumanRealismVariantScore {
  key: string;
  readability: number;
  naturalness: number;
  credibility: number;
  cohesion: number;
  score: number;
}

export interface HumanRealismResult {
  overallScore: number;
  deploymentThrottle: number;
  variantScores: HumanRealismVariantScore[];
  warnings: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function keywordDensity(summary: string, keywords: string[]): number {
  const summaryWords = wordCount(summary) || 1;
  const hits = keywords.reduce((sum, keyword) => {
    const normalized = keyword.toLowerCase().trim();
    if (!normalized) return sum;
    return sum + (summary.toLowerCase().split(normalized).length - 1);
  }, 0);

  return hits / summaryWords;
}

function scoreVariant(variant: HumanRealismVariant): HumanRealismVariantScore {
  const words = wordCount(`${variant.headline} ${variant.summary}`);
  const readability = clamp(100 - Math.abs(words - 48) * 1.5, 35, 100);

  const separatorPenalty = (variant.headline.split("|").length - 1) * 9;
  const keywordDensityRatio = keywordDensity(variant.summary, variant.keywords);
  const keywordPenalty = keywordDensityRatio > 0.16 ? (keywordDensityRatio - 0.16) * 260 : 0;
  const naturalness = clamp(100 - separatorPenalty - keywordPenalty, 20, 100);

  const buzzwordPenalty = variant.keywords.filter((keyword) => keyword.length > 20).length * 4;
  const credibility = clamp(95 - buzzwordPenalty - Math.max(0, variant.keywords.length - 24) * 1.8, 25, 100);

  const headlineTokens = new Set(variant.headline.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const summaryTokens = new Set(variant.summary.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const overlap = Array.from(headlineTokens).filter((token) => summaryTokens.has(token)).length;
  const cohesion = clamp((overlap / Math.max(1, headlineTokens.size)) * 100, 25, 100);

  const score = clamp(readability * 0.25 + naturalness * 0.3 + credibility * 0.2 + cohesion * 0.25, 20, 100);

  return {
    key: variant.key,
    readability: Number(readability.toFixed(1)),
    naturalness: Number(naturalness.toFixed(1)),
    credibility: Number(credibility.toFixed(1)),
    cohesion: Number(cohesion.toFixed(1)),
    score: Number(score.toFixed(1)),
  };
}

export function scoreHumanRealism(variants: HumanRealismVariant[]): HumanRealismResult {
  if (variants.length === 0) {
    return {
      overallScore: 55,
      deploymentThrottle: 0.5,
      variantScores: [],
      warnings: ["No variants available to evaluate realism."],
    };
  }

  const variantScores = variants.map(scoreVariant);
  const overallScore = Number((variantScores.reduce((sum, row) => sum + row.score, 0) / variantScores.length).toFixed(1));

  const warnings = variantScores
    .filter((row) => row.score < 65)
    .map((row) => `${row.key} realism below threshold (${row.score}).`);

  const deploymentThrottle = overallScore < 55 ? 0.35 : overallScore < 68 ? 0.65 : overallScore < 78 ? 0.85 : 1;

  return {
    overallScore,
    deploymentThrottle,
    variantScores,
    warnings,
  };
}
