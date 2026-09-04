export interface ResumeRealismInput {
  key: string;
  text: string;
  atsKeywords: string[];
}

export interface ResumeRealismScore {
  key: string;
  readability: number;
  naturalness: number;
  credibility: number;
  cohesion: number;
  score: number;
  warnings: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scoreOne(input: ResumeRealismInput): ResumeRealismScore {
  const words = wordCount(input.text);
  const readability = clamp(100 - Math.abs(words - 210) * 0.22, 40, 100);

  const lower = input.text.toLowerCase();
  const keywordHits = input.atsKeywords.reduce((sum, keyword) => sum + (lower.split(keyword.toLowerCase()).length - 1), 0);
  const density = keywordHits / Math.max(1, words);
  const naturalness = clamp(100 - Math.max(0, density - 0.09) * 460, 30, 100);

  const inflatedClaims = ["expert", "world-class", "best-in-class", "guru", "master"];
  const inflatedCount = inflatedClaims.reduce((sum, claim) => sum + (lower.split(claim).length - 1), 0);
  const credibility = clamp(96 - inflatedCount * 13, 25, 100);

  const sections = ["summary", "skills", "experience", "tools", "results"];
  const sectionCoverage = sections.filter((section) => lower.includes(section)).length;
  const cohesion = clamp((sectionCoverage / sections.length) * 100, 35, 100);

  const score = clamp(readability * 0.25 + naturalness * 0.3 + credibility * 0.3 + cohesion * 0.15, 20, 100);

  const warnings: string[] = [];
  if (naturalness < 65) warnings.push("keyword_density_high");
  if (credibility < 70) warnings.push("credibility_risk");
  if (readability < 65) warnings.push("readability_risk");

  return {
    key: input.key,
    readability: Number(readability.toFixed(1)),
    naturalness: Number(naturalness.toFixed(1)),
    credibility: Number(credibility.toFixed(1)),
    cohesion: Number(cohesion.toFixed(1)),
    score: Number(score.toFixed(1)),
    warnings,
  };
}

export function scoreResumeRealism(inputs: ResumeRealismInput[]) {
  const variants = inputs.map(scoreOne);
  const overall = variants.length
    ? Number((variants.reduce((sum, row) => sum + row.score, 0) / variants.length).toFixed(1))
    : 55;
  const throttle = overall < 55 ? 0.45 : overall < 68 ? 0.7 : overall < 80 ? 0.88 : 1;

  return {
    overall,
    throttle,
    variants,
    warnings: variants.flatMap((row) => row.warnings.map((warning) => `${row.key}:${warning}`)),
  };
}
