type Deal = {
  complexity?: string;
  urgency?: string;
};

export function choosePricingStrategy(deal: Deal) {
  if (deal.complexity === "high") {
    return "value_based";
  }

  if (deal.urgency === "high") {
    return "premium_fixed";
  }

  return "competitive";
}

export function buildPricingSection(
  price: { recommended: number; anchor: number },
  strategy: string
) {
  if (strategy === "value_based") {
    return `For this project, I recommend a value-based approach. Estimated cost: $${price.anchor} depending on final scope.`;
  }

  if (strategy === "premium_fixed") {
    return `I can complete this quickly and reliably. Fixed rate: $${price.recommended}.`;
  }

  return `I can assist with this at $${price.recommended}, ensuring quality and fast delivery.`;
}
