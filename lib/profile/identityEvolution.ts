import { getLearningEvents, updateProfileAIMemory, type LearningEvent } from "@/lib/learning/learningEngine";

export interface IdentityPerformanceInput {
  identityLabel: string;
  callbacks: number;
  interviews: number;
  offers: number;
  salaryLiftPct: number;
  platformResponseRate: number; // 0-1
  proposalConversionRate: number; // 0-1
  sampleSize: number;
}

export interface IdentityWeight {
  identityLabel: string;
  weight: number;
  confidence: number;
  sampleSize: number;
}

export interface IdentityEvolutionResult {
  primaryIdentity: IdentityWeight;
  rankedIdentities: IdentityWeight[];
  suggestedShift: number;
  strategy: string;
}

function normalizeWeight(value: number): number {
  return Number(Math.max(0.05, Math.min(1, value)).toFixed(3));
}

function scoreIdentity(input: IdentityPerformanceInput): number {
  const callbackScore = input.callbacks * 0.9;
  const interviewScore = input.interviews * 1.2;
  const offerScore = input.offers * 1.8;
  const salaryScore = Math.max(0, input.salaryLiftPct) * 0.06;
  const responseScore = input.platformResponseRate * 8;
  const conversionScore = input.proposalConversionRate * 10;
  const volumeAdjustment = Math.min(1.4, Math.max(0.5, input.sampleSize / 25));

  return (callbackScore + interviewScore + offerScore + salaryScore + responseScore + conversionScore) * volumeAdjustment;
}

export function evolveIdentityWeights(inputs: IdentityPerformanceInput[]): IdentityEvolutionResult {
  if (inputs.length === 0) {
    return {
      primaryIdentity: {
        identityLabel: "Operations Support Specialist",
        weight: 1,
        confidence: 0.3,
        sampleSize: 0,
      },
      rankedIdentities: [],
      suggestedShift: 0,
      strategy: "Insufficient outcome data. Keep current positioning until sample size increases.",
    };
  }

  const scored = inputs.map((input) => {
    const rawScore = scoreIdentity(input);
    const confidence = Math.max(0.35, Math.min(0.96, Number((Math.min(1, input.sampleSize / 40) * (0.65 + input.platformResponseRate * 0.35)).toFixed(2))));
    return {
      identityLabel: input.identityLabel,
      rawScore,
      confidence,
      sampleSize: input.sampleSize,
    };
  }).sort((a, b) => b.rawScore - a.rawScore);

  const total = scored.reduce((sum, row) => sum + row.rawScore, 0) || 1;
  const ranked = scored.map((row) => ({
    identityLabel: row.identityLabel,
    weight: normalizeWeight(row.rawScore / total),
    confidence: row.confidence,
    sampleSize: row.sampleSize,
  }));

  const primary = ranked[0];
  const secondary = ranked[1];
  const suggestedShift = secondary ? Number(((primary.weight - secondary.weight) * 100).toFixed(1)) : Number((primary.weight * 100).toFixed(1));

  const strategy = suggestedShift >= 12
    ? `Shift identity weighting toward ${primary.identityLabel}; observed advantage is ${suggestedShift.toFixed(1)} percentage points.`
    : "Maintain blended identity mix while collecting more conversion outcomes.";

  return {
    primaryIdentity: primary,
    rankedIdentities: ranked,
    suggestedShift,
    strategy,
  };
}

function extractIdentityLabel(event: LearningEvent): string | null {
  const metadata = event.metadata as Record<string, unknown> | undefined;
  const label = metadata?.identity_label ?? metadata?.specialization ?? metadata?.headline;
  const normalized = String(label || "").trim();
  return normalized || null;
}

export async function runIdentityEvolutionForUser(userId: string): Promise<IdentityEvolutionResult> {
  const events = await getLearningEvents(userId);
  const grouped = new Map<string, { callbacks: number; interviews: number; offers: number; salaryLiftPct: number; responses: number; proposals: number; wins: number; samples: number }>();

  for (const event of events) {
    const label = extractIdentityLabel(event);
    if (!label) continue;

    const current = grouped.get(label) ?? {
      callbacks: 0,
      interviews: 0,
      offers: 0,
      salaryLiftPct: 0,
      responses: 0,
      proposals: 0,
      wins: 0,
      samples: 0,
    };

    current.samples += 1;
    const metadata = (event.metadata as Record<string, unknown> | undefined) ?? {};

    if (event.event_type === "client_reply" || event.event_type === "callback") current.callbacks += 1;
    if (event.event_type === "interview") current.interviews += 1;
    if (event.event_type === "offer" || event.event_type === "job_won") current.offers += 1;
    if (event.event_type === "proposal_sent") current.proposals += 1;
    if (event.event_type === "job_won") current.wins += 1;
    if (event.event_type === "client_reply") current.responses += 1;

    const salaryLift = Number(metadata.salary_lift_pct || 0);
    if (Number.isFinite(salaryLift) && salaryLift > 0) {
      current.salaryLiftPct += salaryLift;
    }

    grouped.set(label, current);
  }

  const inputs: IdentityPerformanceInput[] = Array.from(grouped.entries()).map(([identityLabel, value]) => ({
    identityLabel,
    callbacks: value.callbacks,
    interviews: value.interviews,
    offers: value.offers,
    salaryLiftPct: value.salaryLiftPct,
    platformResponseRate: value.proposals > 0 ? value.responses / value.proposals : 0,
    proposalConversionRate: value.proposals > 0 ? value.wins / value.proposals : 0,
    sampleSize: value.samples,
  }));

  const evolution = evolveIdentityWeights(inputs);

  await updateProfileAIMemory(userId, {
    identity_weights: evolution.rankedIdentities,
    primary_identity: evolution.primaryIdentity.identityLabel,
    identity_shift: evolution.suggestedShift,
    identity_strategy: evolution.strategy,
  });

  return evolution;
}
