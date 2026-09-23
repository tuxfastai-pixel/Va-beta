type Deal = {
  urgency: string;
  complexity: string;
  budgetRange: { min: number; max: number };
  longTerm?: boolean;
  urgent?: boolean;
};

type PricingUser = {
  phase?: "early" | "scaling" | string;
};

export function generatePrice(job: { complexity?: string; longTerm?: boolean; urgent?: boolean }, user: PricingUser) {
  let base = 200;

  if (job.complexity === "high") base += 300;
  if (job.longTerm) base += 200;
  if (job.urgent) base += 100;

  if (user.phase === "early") {
    base *= 0.8;
  }

  if (user.phase === "scaling") {
    base *= 1.2;
  }

  return Math.round(base);
}

export function suggestPrice(deal: Deal, career: string) {
  const baseRates: Record<string, number> = {
    teacher: 20,
    admin: 15,
    writer: 25,
    customer_support: 18,
    data_entry: 14,
  };

  let base = baseRates[career] || 15;

  if (deal.complexity === "high") {
    base *= 1.5;
  }

  if (deal.urgency === "high") {
    base *= 1.3;
  }

  const phaseAwarePrice = generatePrice(
    {
      complexity: deal.complexity,
      longTerm: Boolean(deal.longTerm),
      urgent: deal.urgent ?? deal.urgency === "high",
    },
    {
      phase: "early",
    }
  );

  base = Math.max(base, phaseAwarePrice * 0.1);

  if (deal.budgetRange.max > 0) {
    base = Math.min(base, deal.budgetRange.max);
  }

  return {
    recommended: Math.round(base),
    anchor: Math.round(base * 1.25),
    minimum: Math.round(base * 0.8),
  };
}
