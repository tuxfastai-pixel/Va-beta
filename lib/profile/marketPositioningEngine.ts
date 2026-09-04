import type { InferredNiche } from "@/lib/profile/nicheInference";

export interface MarketPositionSignal {
  niche: string;
  averagePay: number;
  demandScore: number; // 0-1
  competitionScore: number; // 0-1 (lower better)
  region?: string;
}

export interface MarketPositioningResult {
  bestPayingNiche: string;
  highestDemandNiche: string;
  lowestCompetitionNiche: string;
  recommendedNicheFocus: string;
  confidence: number;
  rationale: string[];
}

function safeMetric(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function composite(signal: MarketPositionSignal): number {
  const pay = safeMetric(signal.averagePay, 0) / 1000;
  const demand = safeMetric(signal.demandScore, 0.4) * 5;
  const competition = (1 - safeMetric(signal.competitionScore, 0.5)) * 4;
  return pay + demand + competition;
}

export function determineMarketPositioning(
  inferredNiches: InferredNiche[],
  signals: MarketPositionSignal[] = []
): MarketPositioningResult {
  const fallback = inferredNiches.map((niche, index) => ({
    niche: niche.niche,
    averagePay: 1200 + (inferredNiches.length - index) * 200,
    demandScore: Math.max(0.35, niche.confidence),
    competitionScore: Math.max(0.2, 0.65 - niche.confidence / 2),
  }));

  const source = signals.length > 0 ? signals : fallback;

  const bestPaying = source.slice().sort((a, b) => b.averagePay - a.averagePay)[0]?.niche ?? "general_operations";
  const highestDemand = source.slice().sort((a, b) => b.demandScore - a.demandScore)[0]?.niche ?? bestPaying;
  const lowestCompetition = source.slice().sort((a, b) => a.competitionScore - b.competitionScore)[0]?.niche ?? highestDemand;
  const recommended = source.slice().sort((a, b) => composite(b) - composite(a))[0]?.niche ?? highestDemand;

  const confidence = Math.max(
    0.4,
    Math.min(
      0.94,
      Number(
        (
          source.reduce((sum, item) => sum + Math.max(0.2, item.demandScore) + (1 - Math.max(0.1, item.competitionScore)), 0) /
          (source.length * 2.2)
        ).toFixed(2)
      )
    )
  );

  return {
    bestPayingNiche: bestPaying,
    highestDemandNiche: highestDemand,
    lowestCompetitionNiche: lowestCompetition,
    recommendedNicheFocus: recommended,
    confidence,
    rationale: [
      `Best pay: ${bestPaying}`,
      `Highest demand: ${highestDemand}`,
      `Lowest competition: ${lowestCompetition}`,
      `Composite recommendation: ${recommended}`,
    ],
  };
}
