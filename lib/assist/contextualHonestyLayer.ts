export interface HonestyCheckInput {
  proposedText: string;
}

export interface HonestyCheckResult {
  passed: boolean;
  flaggedClaims: string[];
  sanitizedText: string;
}

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  { pattern: /\b(certified|licensed)\b/gi, replacement: "trained", label: "unsupported_certification_claim" },
  { pattern: /\bexpert\b/gi, replacement: "experienced", label: "unsupported_expert_claim" },
  { pattern: /\b10\+ years\b/gi, replacement: "multi-project experience", label: "unverified_years_claim" },
];

export function enforceContextualHonesty(input: HonestyCheckInput): HonestyCheckResult {
  let sanitized = String(input.proposedText || "");
  const flaggedClaims: string[] = [];

  for (const rule of BLOCKED_PATTERNS) {
    const before = sanitized;
    sanitized = sanitized.replace(rule.pattern, rule.replacement);
    if (before !== sanitized) {
      flaggedClaims.push(rule.label);
    }
  }

  return {
    passed: flaggedClaims.length === 0,
    flaggedClaims,
    sanitizedText: sanitized,
  };
}
