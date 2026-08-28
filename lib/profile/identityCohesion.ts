import type { ProfileVariantKey } from "@/lib/profile/profileVariants";
import type { ResumeVariantKey } from "@/lib/resume/resumeVariants";

export interface IdentityCohesionInput {
  primaryIdentity: string;
  primarySpecialization: string;
  primaryResumeVariant?: string;
  profileVariants: Record<ProfileVariantKey, { label: string; optimizedHeadline: string; prioritizedKeywords: string[] }>;
  resumeVariants: Partial<Record<ResumeVariantKey, { label: string; headline: string; prioritizedKeywords: string[] }>>;
}

export interface IdentityCohesionResult {
  score: number;
  consistency: number;
  overlap: number;
  believability: number;
  divergenceRisk: number;
  flags: string[];
  rationale: string[];
}

function normalizeTokens(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function uniqueKeywords(items: string[][]): Set<string> {
  return new Set(items.flat().map((item) => item.toLowerCase().trim()).filter(Boolean));
}

function keywordOverlapRatio(sets: string[][]): number {
  const normalized = sets.map((items) => new Set(items.map((item) => item.toLowerCase().trim()).filter(Boolean)));
  if (normalized.length < 2) return 1;

  const base = normalized[0];
  let intersection = new Set(base);
  for (const set of normalized.slice(1)) {
    intersection = new Set(Array.from(intersection).filter((value) => set.has(value)));
  }

  const union = uniqueKeywords(sets);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function scoreIdentityCohesion(input: IdentityCohesionInput): IdentityCohesionResult {
  const profileEntries = Object.values(input.profileVariants);
  const resumeEntries = Object.values(input.resumeVariants).filter(Boolean) as Array<{ label: string; headline: string; prioritizedKeywords: string[] }>;

  const profileKeywordSets = profileEntries.map((entry) => entry.prioritizedKeywords || []);
  const resumeKeywordSets = resumeEntries.map((entry) => entry.prioritizedKeywords || []);
  const allKeywordSets = [...profileKeywordSets, ...resumeKeywordSets];

  const overlap = Math.max(0, Math.min(1, keywordOverlapRatio(allKeywordSets)));

  const coreIdentityTokens = normalizeTokens(`${input.primaryIdentity} ${input.primarySpecialization}`);
  const profileLabelTokens = profileEntries.map((entry) => normalizeTokens(`${entry.label} ${entry.optimizedHeadline}`));
  const resumeLabelTokens = resumeEntries.map((entry) => normalizeTokens(`${entry.label} ${entry.headline}`));

  const continuityHits = [...profileLabelTokens, ...resumeLabelTokens]
    .map((tokens) => tokens.filter((token) => coreIdentityTokens.includes(token)).length)
    .reduce((sum, value) => sum + value, 0);
  const continuityBase = Math.max(1, [...profileLabelTokens, ...resumeLabelTokens].length * Math.max(1, coreIdentityTokens.length));
  const consistency = Math.max(0, Math.min(1, continuityHits / continuityBase));

  const alignments = [input.primaryIdentity, input.primarySpecialization, input.primaryResumeVariant || ""]
    .map((value) => normalizeTokens(value))
    .flat();
  const coverage = alignments.filter((token) => coreIdentityTokens.includes(token)).length / Math.max(1, alignments.length);
  const believability = Math.max(0.35, Math.min(1, 0.45 + coverage * 0.35 + overlap * 0.2));

  const divergenceRisk = Math.max(0, Math.min(1, 1 - ((consistency * 0.4) + (overlap * 0.35) + (believability * 0.25))));
  const score = Math.max(10, Math.min(100, Number(((1 - divergenceRisk) * 100).toFixed(1))));

  const flags: string[] = [];
  if (divergenceRisk > 0.55) flags.push("identity_fragmentation_risk");
  if (overlap < 0.22) flags.push("low_cross_variant_overlap");
  if (consistency < 0.2) flags.push("weak_identity_continuity");
  if (believability < 0.55) flags.push("believability_risk");

  return {
    score,
    consistency: Number((consistency * 100).toFixed(1)),
    overlap: Number((overlap * 100).toFixed(1)),
    believability: Number((believability * 100).toFixed(1)),
    divergenceRisk: Number((divergenceRisk * 100).toFixed(1)),
    flags,
    rationale: [
      `Consistency across variants: ${(consistency * 100).toFixed(1)}%`,
      `Keyword overlap: ${(overlap * 100).toFixed(1)}%`,
      `Believability: ${(believability * 100).toFixed(1)}%`,
      `Divergence risk: ${(divergenceRisk * 100).toFixed(1)}%`,
    ],
  };
}
