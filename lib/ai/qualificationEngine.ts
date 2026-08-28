type QualificationInput = {
  trust: number;
  risk: number;
  value: number;
};

export function qualifyClient({ trust, risk, value }: QualificationInput) {
  if (risk > 70) {
    return "avoid" as const;
  }

  if (trust > 70 && value > 500) {
    return "high_value" as const;
  }

  if (trust > 50) {
    return "standard" as const;
  }

  return "low_priority" as const;
}

export function getExecutionStrategy(type: ReturnType<typeof qualifyClient>) {
  switch (type) {
    case "high_value":
      return {
        effort: "max",
        pricing: "premium",
        personalization: "deep",
        followUp: true,
        autoApply: true,
      };
    case "standard":
      return {
        effort: "medium",
        pricing: "market",
        personalization: "moderate",
        followUp: false,
        autoApply: true,
      };
    case "low_priority":
      return {
        effort: "low",
        pricing: "competitive",
        personalization: "light",
        followUp: false,
        autoApply: false,
      };
    case "avoid":
      return {
        effort: "none",
        autoApply: false,
      };
    default:
      return {
        effort: "medium",
        pricing: "market",
        personalization: "moderate",
        followUp: false,
        autoApply: false,
      };
  }
}
