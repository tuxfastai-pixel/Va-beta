/**
 * Phase 9B: Hard Constraint Enforcement
 * Central control point for all resume mutations
 * Integrates governance gate with adaptation lifecycle
 */

import { evaluateMutationApproval, type GovernanceCheckpoint, type GovernanceState } from "./governanceGate.ts";
import { calculateAdaptationMultiplier, applyMemoryWeightDecay, checkEscalationThreshold } from "./governanceGate.ts";
import {
  applyRecursiveMemoryWeight,
  calculateStabilityEfficiencyRatio,
  computeEffectiveMutationPower,
  evaluateSelfCalming,
  predictMutationStability,
  recoverTowardBaseline,
  scoreMutationCost,
  type StabilityForecast,
} from "./stabilityPredictionEngine.ts";
import { computeAdaptiveTempo, type TempoOutput } from "./adaptiveTempoController.ts";
import { computeBehavioralInertia, type InertiaOutput } from "./behavioralInertiaEngine.ts";
import { evaluateGradientStabilization, type GradientOutput } from "./gradientStabilization.ts";
import type { ResumeArtifact } from "../resume/resumeGenerator.ts";
import type { InterviewContext } from "../interview/interviewEngine.ts";

export interface AdaptationMemorySignal {
  cyclesAgo: number;
  baseWeight: number;
  unstableMutationPenalty: number;
}

export interface ResumeMutationRequest {
  resume: ResumeArtifact;
  targetKeywords: string[];
  adaptationReason: "ats_optimization" | "interview_alignment" | "specialization" | "realism_improvement";
  proposedChanges: {
    keywordsToAdd: string[];
    keywordsToRemove: string[];
    summaryUpdates?: string;
    skillReordering?: string[];
  };
  governanceState: GovernanceState;
  interviewContext?: InterviewContext;
  warningDensity?: number;
  governanceHealth?: number;
  adaptationHistory?: AdaptationMemorySignal[];
  alignmentVolatility?: number;
  terminologyInflation?: number;
  atsDriftDelta?: number;
  recruiterSuspicionTrend?: number;
  benefitScoreHint?: number;
  trustConsistency?: number;
  stabilityAge?: number;
  recruiterTrustScore?: number;
  alignmentConsistency?: number;
  realismPersistence?: number;
  identityFragmentationRisk?: number;
  warningHistory?: number[];
  riskHistory?: number[];
  driftHistory?: number[];
}

export interface MutationDecision {
  approved: boolean;
  governanceCheckpoint: GovernanceCheckpoint;
  appliedMultiplier: number;
  stabilityForecast: StabilityForecast;
  mutationFrozen: boolean;
  allowedChanges: {
    keywordAddLimit: number;
    keywordRemoveLimit: number;
    summaryMutationAllowed: boolean;
    skillReorderingAllowed: boolean;
  };
  debugInfo: {
    realismFloorStatus: string;
    cooldownStatus: string;
    decayApplied: number;
    mutationCost: number;
    mutationBenefit: number;
    effectiveMutationPower: number;
    systemMode: "normal" | "stabilization";
    tempo: TempoOutput;
    inertia: InertiaOutput;
    gradient: GradientOutput;
  };
}

/**
 * Enforce Hard Realism Floors
 * if (realismScore < 0.55) { freezeResumeEvolution = true }
 */
function enforceRealismFloor(state: GovernanceState): {
  frozen: boolean;
  reason?: string;
} {
  const HARD_REALISM_FLOOR = 0.55;

  if (state.realismScore < HARD_REALISM_FLOOR) {
    return {
      frozen: true,
      reason: `Hard realism floor (${(HARD_REALISM_FLOOR * 100).toFixed(0)}%) breached. Resume evolution FROZEN. Score: ${(state.realismScore * 100).toFixed(0)}%`,
    };
  }

  return { frozen: false };
}

/**
 * Core Mutation Gate
 * Single entry point for all resume modifications
 * Enforces hard stops, not just warnings
 */
export async function gatekeepMutation(request: ResumeMutationRequest): Promise<MutationDecision> {
  const warningDensity = request.warningDensity ?? 0;
  const governanceHealth = request.governanceHealth ?? 0.8;
  const alignmentVolatility = request.alignmentVolatility ?? (1 - request.governanceState.alignmentScore);
  const terminologyInflation = request.terminologyInflation ?? Math.min(1, request.proposedChanges.keywordsToAdd.length / 12);
  const atsDriftDelta = request.atsDriftDelta ?? Math.min(1, request.proposedChanges.keywordsToAdd.length / 10);
  const recruiterSuspicionTrend = request.recruiterSuspicionTrend ?? request.governanceState.recruiterSuspicionRisk;
  const trustConsistency = request.trustConsistency ?? Math.max(0, 1 - recruiterSuspicionTrend * 0.85);

  const stabilityEfficiencyRatio = Math.max(
    0.1,
    Math.min(
      1,
      calculateStabilityEfficiencyRatio(
        Math.max(1, request.governanceState.mutations - 1),
        Math.max(1, request.governanceState.mutations)
      )
    )
  );

  const tempo = computeAdaptiveTempo({
    governanceHealth,
    realismScore: request.governanceState.realismScore,
    stabilityEfficiencyRatio,
    recruiterSuspicionRisk: request.governanceState.recruiterSuspicionRisk,
    warningDensity,
    trustConsistency,
  });

  const inertia = computeBehavioralInertia({
    stabilityAge: request.stabilityAge ?? Math.max(1, request.governanceState.mutations),
    recruiterTrustScore: request.recruiterTrustScore ?? Math.max(0, 1 - request.governanceState.recruiterSuspicionRisk),
    alignmentConsistency: request.alignmentConsistency ?? request.governanceState.alignmentScore,
    realismPersistence: request.realismPersistence ?? request.governanceState.realismScore,
    identityFragmentationRisk: request.identityFragmentationRisk ?? request.governanceState.fragmentation,
  });

  const gradient = evaluateGradientStabilization({
    warningHistory: request.warningHistory ?? [warningDensity],
    riskHistory: request.riskHistory ?? [request.governanceState.recruiterSuspicionRisk],
    driftHistory: request.driftHistory ?? [alignmentVolatility],
  });

  const stabilityForecast = predictMutationStability({
    atsDriftDelta,
    realismScore: request.governanceState.realismScore,
    terminologyInflation,
    alignmentVolatility,
    recruiterSuspicionTrend,
    identityFragmentationPressure: request.governanceState.fragmentation,
    governanceHealth,
    warningDensity,
    recentGovernorInterventionRate: Math.min(1, request.governanceState.mutations / 12),
  });

  const calming = evaluateSelfCalming({
    warningDensity,
    realismScore: request.governanceState.realismScore,
    alignmentScore: request.governanceState.alignmentScore,
    governanceHealth,
  });

  const mutationCostScore = scoreMutationCost({
    benefitScore:
      request.benefitScoreHint ??
      Math.min(1, request.governanceState.alignmentScore * 0.6 + (1 - request.governanceState.fragmentation) * 0.4),
    realismPenalty: Math.max(0, 1 - request.governanceState.realismScore),
    credibilityPenalty: request.governanceState.recruiterSuspicionRisk,
    volatilityPenalty: alignmentVolatility,
  });

  const friction = computeEffectiveMutationPower(
    1,
    request.governanceState.realismScore,
    request.governanceState.alignmentScore,
    governanceHealth
  );

  const recursiveHistory = request.adaptationHistory ?? [];
  const recursiveWeight = recursiveHistory.length
    ? recursiveHistory.reduce(
        (sum, entry) =>
          sum +
          applyRecursiveMemoryWeight({
            baseWeight: entry.baseWeight,
            cyclesAgo: entry.cyclesAgo,
            unstableMutationPenalty: entry.unstableMutationPenalty,
            instabilityPressure: request.governanceState.fragmentation,
          }),
        0
      ) / recursiveHistory.length
    : 1;

  const decision: MutationDecision = {
    approved: false,
    governanceCheckpoint: {
      realismCheckPassed: false,
      interviewCheckPassed: false,
      identityCheckPassed: false,
      credibilityCheckPassed: false,
      atsOptimizationCheckPassed: false,
      approvalCount: 0,
      rejectionCount: 0,
      overallApproved: false,
      blockingReasons: [],
      mutationFrozen: false,
      governorVotes: [],
    },
    appliedMultiplier: 0,
    stabilityForecast,
    mutationFrozen: false,
    allowedChanges: {
      keywordAddLimit: 0,
      keywordRemoveLimit: 0,
      summaryMutationAllowed: false,
      skillReorderingAllowed: false,
    },
    debugInfo: {
      realismFloorStatus: "",
      cooldownStatus: "",
      decayApplied: 0,
      mutationCost: mutationCostScore.mutationCost,
      mutationBenefit: mutationCostScore.benefitScore,
      effectiveMutationPower: friction.effectiveMutationPower,
      systemMode: gradient.stabilizationRequired || tempo.mode === "stabilizing" || tempo.mode === "recovery"
        ? "stabilization"
        : calming.systemMode,
      tempo,
      inertia,
      gradient,
    },
  };

  // Step 0: Anticipatory regulation before any governor load.
  if (!stabilityForecast.safe) {
    decision.mutationFrozen = true;
    decision.governanceCheckpoint.mutationFrozen = true;
    decision.governanceCheckpoint.blockingReasons.push(
      `Predictive stability denied mutation. Risk ${Math.round(stabilityForecast.projectedRisk * 100)}%, expected intervention ${Math.round(stabilityForecast.expectedGovernorIntervention * 100)}%`
    );
    return decision;
  }

  if (!mutationCostScore.approved) {
    decision.mutationFrozen = true;
    decision.governanceCheckpoint.mutationFrozen = true;
    decision.governanceCheckpoint.blockingReasons.push(
      `Mutation cost ${mutationCostScore.mutationCost.toFixed(2)} exceeds benefit ${mutationCostScore.benefitScore.toFixed(2)}.`
    );
    return decision;
  }

  if (request.governanceState.fragmentation > inertia.maxAllowedDrift && inertia.inertiaState === "locked") {
    decision.mutationFrozen = true;
    decision.governanceCheckpoint.mutationFrozen = true;
    decision.governanceCheckpoint.blockingReasons.push(
      `Behavioral inertia lock engaged. Fragmentation ${request.governanceState.fragmentation.toFixed(2)} exceeded drift ceiling ${inertia.maxAllowedDrift.toFixed(2)}.`
    );
    return decision;
  }

  const stabilizationMode =
    gradient.stabilizationRequired ||
    tempo.mode === "stabilizing" ||
    tempo.mode === "recovery" ||
    calming.systemMode === "stabilization";

  if (stabilizationMode) {
    const recovered = recoverTowardBaseline({
      volatility: alignmentVolatility,
      realismScore: request.governanceState.realismScore,
      trustScore: 1 - request.governanceState.recruiterSuspicionRisk,
      adaptationIntensity: friction.effectiveMutationPower,
    });
    decision.governanceCheckpoint.blockingReasons.push(
      `Self-calming stabilization active. Recovery target -> volatility ${recovered.volatility.toFixed(2)}, realism ${recovered.realismScore.toFixed(2)}, trust ${recovered.trustScore.toFixed(2)}`
    );

    if (calming.freezeAtsExperimentation || tempo.mode === "recovery") {
      decision.mutationFrozen = true;
      decision.governanceCheckpoint.mutationFrozen = true;
      return decision;
    }
  }

  // Step 1: Check Hard Realism Floor
  const realismFloorCheck = enforceRealismFloor(request.governanceState);
  decision.debugInfo.realismFloorStatus = realismFloorCheck.reason || "PASSED";

  if (realismFloorCheck.frozen) {
    decision.mutationFrozen = true;
    decision.governanceCheckpoint.mutationFrozen = true;
    decision.governanceCheckpoint.blockingReasons.push(realismFloorCheck.reason || "");
    return decision;
  }

  // Step 2: Evaluate Multi-Approval Gate
  decision.governanceCheckpoint = evaluateMutationApproval(
    request.resume,
    request.governanceState,
    request.interviewContext
  );

  if (decision.governanceCheckpoint.mutationFrozen) {
    decision.mutationFrozen = true;
    decision.debugInfo.cooldownStatus = `Frozen - ${decision.governanceCheckpoint.blockingReasons[decision.governanceCheckpoint.blockingReasons.length - 1] || "Governance rejection"}`;
    return decision;
  }

  // Step 3: Calculate Adaptive Cooldown Multiplier
  decision.appliedMultiplier =
    calculateAdaptationMultiplier(request.governanceState.alignmentScore * 100) *
    friction.stabilityCoefficient *
    calming.optimizationFrequencyMultiplier *
    tempo.adaptationVelocity *
    (1 - inertia.mutationResistance * 0.35);
  decision.debugInfo.cooldownStatus = `Multiplier: ${decision.appliedMultiplier}x (alignment: ${(request.governanceState.alignmentScore * 100).toFixed(0)}%)`;

  // Step 4: Apply Memory Weight Decay to Proposed Keywords
  const decayFactor = 0.95; // 5% decay per cycle
  const proposedDecay = applyMemoryWeightDecay(
    request.proposedChanges.keywordsToAdd.length,
    5, // Assume 5 cycles of history
    decayFactor
  );
  decision.debugInfo.decayApplied = Number((proposedDecay * recursiveWeight).toFixed(4));

  // Step 5: Calculate Allowed Changes (based on multiplier and decay)
  const baseKeywordLimit = 3;
  const breadthScaledLimit = baseKeywordLimit * decision.appliedMultiplier * recursiveWeight * Math.max(0.25, tempo.explorationBreadth);
  const inertiaConstrainedLimit = breadthScaledLimit * Math.max(0.2, 1 - inertia.mutationResistance);
  decision.allowedChanges.keywordAddLimit = Math.max(0, Math.floor(inertiaConstrainedLimit));
  decision.allowedChanges.keywordRemoveLimit = Math.floor(2 * decision.appliedMultiplier);
  decision.allowedChanges.summaryMutationAllowed =
    request.governanceState.alignmentScore > 0.7 && inertia.inertiaState !== "locked";
  decision.allowedChanges.skillReorderingAllowed =
    request.governanceState.realismScore > 0.65 && tempo.stabilizationBias < 0.78;

  if (gradient.stabilizationRequired) {
    decision.allowedChanges.keywordAddLimit = Math.min(decision.allowedChanges.keywordAddLimit, 1);
    decision.allowedChanges.summaryMutationAllowed = false;
  }

  if (tempo.mode === "recovery") {
    decision.allowedChanges.keywordAddLimit = 0;
    decision.allowedChanges.keywordRemoveLimit = 0;
    decision.allowedChanges.skillReorderingAllowed = false;
  }

  // Step 6: FINAL APPROVAL
  // All governors passed AND multiplier allows changes
  decision.approved = decision.governanceCheckpoint.overallApproved && decision.appliedMultiplier > 0;

  return decision;
}

/**
 * Apply Approved Mutation
 * Only called after gatekeepMutation returns approved=true
 */
export function applyConstrainedMutation(
  resume: ResumeArtifact,
  decision: MutationDecision,
  request: ResumeMutationRequest
): ResumeArtifact {
  if (!decision.approved) {
    return resume; // Mutation blocked
  }

  const mutated = { ...resume };

  // Apply keyword additions (limited by allowed count)
  const keywordsToAdd = request.proposedChanges.keywordsToAdd.slice(0, decision.allowedChanges.keywordAddLimit);
  mutated.atsKeywords = Array.from(new Set([...(mutated.atsKeywords || []), ...keywordsToAdd])).slice(0, 40); // Cap at 40 total keywords

  // Apply keyword removals (limited by allowed count)
  const keywordsToRemove = new Set(
    request.proposedChanges.keywordsToRemove.slice(0, decision.allowedChanges.keywordRemoveLimit)
  );
  mutated.atsKeywords = (mutated.atsKeywords || []).filter((k) => !keywordsToRemove.has(k));

  // Apply summary updates if allowed
  if (decision.allowedChanges.summaryMutationAllowed && request.proposedChanges.summaryUpdates) {
    mutated.summary = request.proposedChanges.summaryUpdates;
  }

  // Apply skill reordering if allowed
  if (decision.allowedChanges.skillReorderingAllowed && request.proposedChanges.skillReordering) {
    mutated.coreSkills = request.proposedChanges.skillReordering;
  }

  return mutated;
}

/**
 * Constrained Adaptation Cycle
 * Orchestrates mutation gating → decision → application with full hard enforcement
 */
export async function constrainedAdaptationCycle(request: ResumeMutationRequest): Promise<{
  approved: boolean;
  resume: ResumeArtifact;
  decision: MutationDecision;
  applyMultiplier: (value: number) => number;
}> {
  // Gatekeeper decision
  const decision = await gatekeepMutation(request);

  // If frozen, return original resume
  if (decision.mutationFrozen || !decision.approved) {
    return {
      approved: false,
      resume: request.resume,
      decision,
      applyMultiplier: (v) => v * decision.appliedMultiplier,
    };
  }

  // Apply mutation with constraints
  const mutatedResume = applyConstrainedMutation(request.resume, decision, request);

  return {
    approved: true,
    resume: mutatedResume,
    decision,
    applyMultiplier: (value: number) => value * decision.appliedMultiplier,
  };
}

/**
 * Batch Mutation Validator
 * For stress testing: validate multiple mutations would be blocked
 */
export async function validateMutationBatch(
  mutations: ResumeMutationRequest[],
  emergencyThreshold: number = 0.7
): Promise<{
  totalRequests: number;
  approved: number;
  blocked: number;
  emergencyFreezeSuggested: boolean;
}> {
  const results = await Promise.all(mutations.map((m) => gatekeepMutation(m)));

  const blocked = results.filter((r) => r.mutationFrozen || !r.governanceCheckpoint.overallApproved).length;
  const approved = results.length - blocked;

  // Check if rejection rate suggests escalation
  const rejectionRate = blocked / results.length;
  const emergencyFreezeSuggested = rejectionRate > emergencyThreshold;

  return {
    totalRequests: results.length,
    approved,
    blocked,
    emergencyFreezeSuggested,
  };
}
