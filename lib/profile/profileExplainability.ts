export interface ExplainabilityInput {
  primaryIdentity: string;
  identityShift: number;
  identityStabilityScore: number;
  adaptationThrottle: number;
  previousConfidence?: number;
  currentConfidence: number;
  selectedKeywords: string[];
  droppedKeywords: string[];
  previousMarketFocus?: string;
  nextMarketFocus: string;
  rationale: {
    identity: string[];
    market: string[];
    stability: string[];
    realism: string[];
  };
}

export interface ExplainabilityResult {
  whyIdentityChosen: string[];
  whyATSKeywordsChanged: string[];
  whyPositioningShifted: string[];
  whyConfidenceChanged: string[];
  governanceSummary: string;
}

export function buildProfileExplainability(input: ExplainabilityInput): ExplainabilityResult {
  const confidenceDelta = Number((input.currentConfidence - Number(input.previousConfidence || 0)).toFixed(1));

  const whyIdentityChosen = [
    `Primary identity selected: ${input.primaryIdentity}.`,
    `Identity shift pressure: ${input.identityShift.toFixed(1)} percentage points.`,
    ...input.rationale.identity,
  ];

  const whyATSKeywordsChanged = [
    `Selected keywords (${input.selectedKeywords.length}): ${input.selectedKeywords.slice(0, 10).join(", ") || "none"}.`,
    `Dropped keywords (${input.droppedKeywords.length}): ${input.droppedKeywords.slice(0, 8).join(", ") || "none"}.`,
    `ATS adaptation throttle applied at ${(input.adaptationThrottle * 100).toFixed(0)}% due to stability guardrails.`,
  ];

  const whyPositioningShifted = [
    `Market focus moved from ${input.previousMarketFocus || "n/a"} to ${input.nextMarketFocus}.`,
    ...input.rationale.market,
    ...input.rationale.stability,
  ];

  const whyConfidenceChanged = [
    `Confidence changed by ${confidenceDelta >= 0 ? "+" : ""}${confidenceDelta} points.`,
    `Current identity stability score: ${input.identityStabilityScore}%.`,
    ...input.rationale.realism,
  ];

  return {
    whyIdentityChosen,
    whyATSKeywordsChanged,
    whyPositioningShifted,
    whyConfidenceChanged,
    governanceSummary: `Stability ${input.identityStabilityScore}% with throttle ${(input.adaptationThrottle * 100).toFixed(0)}% to prevent drift and overfitting.`,
  };
}
