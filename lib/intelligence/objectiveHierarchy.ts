export type ObjectiveLevel =
  | "system_stability"
  | "revenue_quality"
  | "sla_compliance"
  | "profit_optimization"
  | "growth_speed";

export interface ObjectiveSignalInput {
  systemHealthScore: number;
  slaBreachProbability: number;
  overloadRisk: number;
  churnHighRiskCount: number;
  revenueConfidence: number;
}

export interface ObjectiveEvaluation {
  allowed: boolean;
  activePriority: ObjectiveLevel;
  reasons: string[];
}

export const OBJECTIVE_PRIORITY_STACK: ObjectiveLevel[] = [
  "system_stability",
  "revenue_quality",
  "sla_compliance",
  "profit_optimization",
  "growth_speed",
];

export function evaluateObjectiveHierarchy(input: ObjectiveSignalInput): ObjectiveEvaluation {
  const reasons: string[] = [];

  if (input.systemHealthScore < 60 || input.overloadRisk > 80) {
    reasons.push("System stability priority active: health low or overload high");
    return { allowed: false, activePriority: "system_stability", reasons };
  }

  if (input.revenueConfidence < 0.45 || input.churnHighRiskCount > 8) {
    reasons.push("Revenue quality priority active: low confidence or high churn risk");
    return { allowed: false, activePriority: "revenue_quality", reasons };
  }

  if (input.slaBreachProbability > 70) {
    reasons.push("SLA compliance priority active: breach probability high");
    return { allowed: false, activePriority: "sla_compliance", reasons };
  }

  reasons.push("Profit optimization and growth can proceed under current system conditions");
  return { allowed: true, activePriority: "profit_optimization", reasons };
}
