import type { LearningEvent } from "@/lib/learning/learningEngine";
import type { ResumeVariant, ResumeVariantKey } from "@/lib/resume/resumeVariants";

export interface ResumeVariantPerformance {
  key: ResumeVariantKey;
  proposals: number;
  callbacks: number;
  interviews: number;
  wins: number;
  callbackRate: number;
  interviewRate: number;
  conversionRate: number;
  salaryLift: number;
  score: number;
}

export interface ResumeEvolutionResult {
  rankedVariants: ResumeVariantPerformance[];
  primaryVariant: ResumeVariantKey;
  confidence: number;
  wordingHints: string[];
  orderingHints: string[];
  emphasisHints: string[];
}

function normalizeKey(value: unknown): ResumeVariantKey | null {
  const key = String(value || "").trim() as ResumeVariantKey;
  const allowed: ResumeVariantKey[] = [
    "indeed_resume",
    "linkedin_resume",
    "flexjobs_resume",
    "tender_resume",
    "freelance_resume",
    "corporate_operations_resume",
  ];
  return allowed.includes(key) ? key : null;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function evolveResumeVariants(variants: Record<ResumeVariantKey, ResumeVariant>, events: LearningEvent[]): ResumeEvolutionResult {
  const rows = new Map<ResumeVariantKey, { proposals: number; callbacks: number; interviews: number; wins: number; salary: number }>();

  (Object.keys(variants) as ResumeVariantKey[]).forEach((key) => {
    rows.set(key, { proposals: 0, callbacks: 0, interviews: 0, wins: 0, salary: 0 });
  });

  for (const event of events) {
    const metadata = (event.metadata as Record<string, unknown> | undefined) ?? {};
    const key = normalizeKey(metadata.selected_resume_variant);
    if (!key || !rows.has(key)) continue;

    const row = rows.get(key)!;
    if (event.event_type === "proposal_sent") row.proposals += 1;
    if (event.event_type === "client_reply" || event.event_type === "callback") row.callbacks += 1;
    if (event.event_type === "interview") row.interviews += 1;
    if (event.event_type === "job_won" || event.event_type === "offer") row.wins += 1;

    const salaryLift = Number(metadata.salary_lift_pct || 0);
    if (Number.isFinite(salaryLift) && salaryLift > 0) {
      row.salary += salaryLift;
    }

    rows.set(key, row);
  }

  const rankedVariants = Array.from(rows.entries()).map(([key, value]) => {
    const callbackRate = value.proposals > 0 ? value.callbacks / value.proposals : 0;
    const interviewRate = value.proposals > 0 ? value.interviews / value.proposals : 0;
    const conversionRate = value.proposals > 0 ? value.wins / value.proposals : 0;
    const salaryLift = value.wins > 0 ? value.salary / value.wins : 0;
    const score = callbackRate * 35 + interviewRate * 25 + conversionRate * 30 + Math.min(10, salaryLift * 0.5);

    return {
      key,
      proposals: value.proposals,
      callbacks: value.callbacks,
      interviews: value.interviews,
      wins: value.wins,
      callbackRate: round(callbackRate),
      interviewRate: round(interviewRate),
      conversionRate: round(conversionRate),
      salaryLift: round(salaryLift),
      score: round(score),
    };
  }).sort((a, b) => b.score - a.score);

  const primaryVariant = rankedVariants[0]?.key || "indeed_resume";
  const confidence = rankedVariants[0]?.proposals
    ? Math.min(0.95, Number((rankedVariants[0].score / 100 + Math.min(0.4, rankedVariants[0].proposals / 50)).toFixed(2)))
    : 0.35;

  return {
    rankedVariants,
    primaryVariant,
    confidence,
    wordingHints: [
      "Emphasize defensible outcomes over inflated claims.",
      "Use direct operational language with measurable context.",
    ],
    orderingHints: [
      "Lead with the highest-performing resume variant summary.",
      "Keep tools and execution evidence above long generic objective text.",
    ],
    emphasisHints: [
      "Increase focus on sections correlated with callback and interview gains.",
      "Reduce low-performing keyword clusters over time.",
    ],
  };
}
