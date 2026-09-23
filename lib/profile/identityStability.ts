import type { AgentMemory } from "@/lib/learning/learningEngine";
import type { IdentityWeight } from "@/lib/profile/identityEvolution";

export interface IdentityStabilityInput {
  previousMemory: AgentMemory;
  nextWeights: IdentityWeight[];
  nextPrimaryIdentity: string;
  suggestedShift: number;
}

export interface IdentityStabilityResult {
  score: number;
  adaptationThrottle: number;
  atsReshapeThrottle: number;
  reinforcementAggressiveness: number;
  flags: string[];
  rationale: string[];
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function normalizedEntropy(weights: number[]): number {
  if (weights.length <= 1) return 0;
  const epsilon = 1e-9;
  const entropy = -weights.reduce((sum, weight) => sum + weight * Math.log2(Math.max(epsilon, weight)), 0);
  const maxEntropy = Math.log2(weights.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

export function scoreIdentityStability(input: IdentityStabilityInput): IdentityStabilityResult {
  const weights = input.nextWeights.map((row) => Math.max(0.001, row.weight));
  const primary = input.nextWeights[0]?.weight ?? 1;
  const secondary = input.nextWeights[1]?.weight ?? 0;
  const fragmentationCount = input.nextWeights.filter((row) => row.weight >= 0.18).length;

  const previousPrimary = String(input.previousMemory.primary_identity || "").trim();
  const previousShift = Number(input.previousMemory.identity_shift || 0);
  const primaryChanged = Boolean(previousPrimary) && previousPrimary !== input.nextPrimaryIdentity;
  const shiftDelta = Math.abs(input.suggestedShift - previousShift);

  const spread = normalizedEntropy(weights);
  const overSpecialized = primary >= 0.78 && secondary <= 0.12;
  const fragmented = fragmentationCount >= 4;

  const penalties = [
    overSpecialized ? 18 : 0,
    fragmented ? 14 : 0,
    primaryChanged ? 10 : 0,
    Math.min(24, Math.max(0, shiftDelta * 0.45)),
    Math.max(0, (spread - 0.78) * 35),
  ];

  const score = Math.max(10, Math.min(100, Math.round(100 - penalties.reduce((sum, value) => sum + value, 0))));

  const adaptationThrottle = score < 50 ? 0.4 : score < 65 ? 0.6 : score < 78 ? 0.78 : 1;
  const atsReshapeThrottle = score < 55 ? 0.5 : score < 72 ? 0.72 : 1;
  const reinforcementAggressiveness = score < 55 ? 0.35 : score < 72 ? 0.6 : score < 86 ? 0.8 : 1;

  const flags: string[] = [];
  if (overSpecialized) flags.push("over_specialization_risk");
  if (fragmented) flags.push("identity_fragmentation_risk");
  if (primaryChanged) flags.push("primary_identity_shift_detected");
  if (shiftDelta >= 20) flags.push("unstable_positioning_shift");

  const rationale = [
    `Primary weight: ${(primary * 100).toFixed(1)}%`,
    `Identity spread (entropy): ${(spread * 100).toFixed(1)}%`,
    `Fragment count: ${fragmentationCount}`,
    `Primary changed: ${primaryChanged ? "yes" : "no"}`,
    `Shift delta: ${shiftDelta.toFixed(1)} pts`,
  ];

  return {
    score,
    adaptationThrottle: round(adaptationThrottle),
    atsReshapeThrottle: round(atsReshapeThrottle),
    reinforcementAggressiveness: round(reinforcementAggressiveness),
    flags,
    rationale,
  };
}
