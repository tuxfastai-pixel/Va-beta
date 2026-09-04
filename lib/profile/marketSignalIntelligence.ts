import type { LearningEvent } from "@/lib/learning/learningEngine";
import type { InferredNiche } from "@/lib/profile/nicheInference";

export interface NicheMarketSignal {
  niche: string;
  demandScore: number;
  salaryTrend: number;
  saturationScore: number;
  momentum: number;
}

export interface PlatformSignal {
  platform: string;
  strength: number;
  momentum: number;
}

export interface MarketSignalIntelligenceResult {
  risingNiches: NicheMarketSignal[];
  improvingSalaries: NicheMarketSignal[];
  weakeningPlatforms: PlatformSignal[];
  saturatingCategories: NicheMarketSignal[];
  recommendedProactiveShift?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function getIdentityKey(event: LearningEvent): string {
  const metadata = (event.metadata as Record<string, unknown> | undefined) ?? {};
  return String(metadata.identity_label || metadata.niche || metadata.specialization || "general_operations").trim() || "general_operations";
}

function getAmount(event: LearningEvent): number {
  const metadata = (event.metadata as Record<string, unknown> | undefined) ?? {};
  const amount = Number(metadata.amount || metadata.pay_amount || metadata.salary || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function deriveMarketSignalIntelligence(
  inferredNiches: InferredNiche[],
  events: LearningEvent[]
): MarketSignalIntelligenceResult {
  const nicheStats = new Map<string, { proposals: number; replies: number; wins: number; amount: number; recencyBoost: number }>();
  const platformStats = new Map<string, { proposals: number; replies: number; wins: number; recentWins: number; oldWins: number }>();

  const chronological = events.slice().reverse();
  const midpoint = Math.floor(chronological.length / 2);

  chronological.forEach((event, index) => {
    const niche = getIdentityKey(event);
    const platform = String(((event.metadata as Record<string, unknown> | undefined) ?? {}).platform || "unknown").toLowerCase().trim() || "unknown";

    const nicheRow = nicheStats.get(niche) ?? { proposals: 0, replies: 0, wins: 0, amount: 0, recencyBoost: 0 };
    const platformRow = platformStats.get(platform) ?? { proposals: 0, replies: 0, wins: 0, recentWins: 0, oldWins: 0 };

    if (event.event_type === "proposal_sent") {
      nicheRow.proposals += 1;
      platformRow.proposals += 1;
    }

    if (event.event_type === "client_reply" || event.event_type === "callback") {
      nicheRow.replies += 1;
      platformRow.replies += 1;
    }

    if (event.event_type === "job_won" || event.event_type === "offer") {
      nicheRow.wins += 1;
      nicheRow.amount += getAmount(event);
      platformRow.wins += 1;
      if (index >= midpoint) {
        platformRow.recentWins += 1;
      } else {
        platformRow.oldWins += 1;
      }
    }

    if (index >= midpoint) {
      nicheRow.recencyBoost += 1;
    }

    nicheStats.set(niche, nicheRow);
    platformStats.set(platform, platformRow);
  });

  const fallbackNiches = inferredNiches.map((item) => item.niche);
  if (fallbackNiches.length > 0) {
    for (const niche of fallbackNiches) {
      if (!nicheStats.has(niche)) {
        nicheStats.set(niche, { proposals: 0, replies: 0, wins: 0, amount: 0, recencyBoost: 0 });
      }
    }
  }

  const nicheSignals: NicheMarketSignal[] = Array.from(nicheStats.entries()).map(([niche, stats]) => {
    const demand = stats.proposals > 0 ? (stats.replies + stats.wins * 1.4) / stats.proposals : 0.35;
    const averageAmount = stats.wins > 0 ? stats.amount / stats.wins : 0;
    const salaryTrend = averageAmount > 0 ? averageAmount / 1000 : 0;
    const saturation = stats.proposals > 0 ? clamp(1 - (stats.replies + stats.wins) / stats.proposals, 0, 1) : 0.45;
    const momentum = stats.recencyBoost > 0 ? clamp((stats.wins + stats.replies * 0.5) / stats.recencyBoost, 0, 1) : 0.35;

    return {
      niche,
      demandScore: round(clamp(demand, 0, 1)),
      salaryTrend: round(salaryTrend),
      saturationScore: round(saturation),
      momentum: round(momentum),
    };
  });

  const platformSignals: PlatformSignal[] = Array.from(platformStats.entries()).map(([platform, stats]) => {
    const response = stats.proposals > 0 ? (stats.replies + stats.wins * 1.25) / stats.proposals : 0.3;
    const momentum = stats.oldWins > 0 ? (stats.recentWins - stats.oldWins) / stats.oldWins : stats.recentWins > 0 ? 0.4 : 0;
    return {
      platform,
      strength: round(clamp(response, 0, 1)),
      momentum: round(clamp(momentum, -1, 1)),
    };
  });

  const risingNiches = nicheSignals.slice().sort((a, b) => b.momentum - a.momentum).slice(0, 4);
  const improvingSalaries = nicheSignals.slice().sort((a, b) => b.salaryTrend - a.salaryTrend).slice(0, 4);
  const weakeningPlatforms = platformSignals
    .slice()
    .sort((a, b) => (a.strength + a.momentum) - (b.strength + b.momentum))
    .slice(0, 3);
  const saturatingCategories = nicheSignals.slice().sort((a, b) => b.saturationScore - a.saturationScore).slice(0, 4);

  const proactiveCandidate = nicheSignals
    .slice()
    .sort((a, b) => (b.demandScore + b.momentum + b.salaryTrend * 0.1) - (a.demandScore + a.momentum + a.salaryTrend * 0.1))[0];

  return {
    risingNiches,
    improvingSalaries,
    weakeningPlatforms,
    saturatingCategories,
    recommendedProactiveShift: proactiveCandidate?.niche,
  };
}
