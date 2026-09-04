/**
 * Phase 9B: Governance Gate
 * Multi-approval enforcement for resume mutations
 * Prevents single-point failures; requires consensus from 4 governors
 */

import { analyzeDrift } from "./interviewDriftEngine.ts";
import { assessRecruiterSuspicionRisk } from "./recruiterSuspicionRisk.ts";
import type { ResumeArtifact } from "../resume/resumeGenerator.ts";
import type { InterviewContext } from "../interview/interviewEngine.ts";

export interface GovernanceCheckpoint {
  realismCheckPassed: boolean;
  interviewCheckPassed: boolean;
  identityCheckPassed: boolean;
  credibilityCheckPassed: boolean;
  atsOptimizationCheckPassed: boolean;
  approvalCount: number;
  rejectionCount: number;
  overallApproved: boolean;
  blockingReasons: string[];
  mutationFrozen: boolean;
  governorVotes: Array<{ governor: string; vote: "approve" | "reject"; reason?: string }>;
}

export interface GovernanceState {
  realismScore: number;
  alignmentScore: number;
  fragmentation: number;
  recruiterSuspicionRisk: number;
  mutations: number;
  frozenUntil?: Date;
  emergencyFreeze: boolean;
}

/**
 * Hard Realism Floor Check
 * BLOCKS all mutations if realism < 0.55
 */
function checkRealismFloor(
  realismScore: number,
  resume: ResumeArtifact
): { passed: boolean; reason?: string } {
  const HARD_REALISM_FLOOR = 0.55;

  if (realismScore < HARD_REALISM_FLOOR) {
    return {
      passed: false,
      reason: `Realism score ${(realismScore * 100).toFixed(0)}% below hard floor of ${(HARD_REALISM_FLOOR * 100).toFixed(0)}%. Resume evolution FROZEN.`,
    };
  }

  return { passed: true };
}

/**
 * Interview Governor Check
 * Validates alignment score and terminology consistency
 */
function checkInterviewAlignment(
  alignmentScore: number,
  interviewContext?: InterviewContext
): { passed: boolean; reason?: string } {
  const INTERVIEW_MIN_ALIGNMENT = 0.6;

  if (alignmentScore < INTERVIEW_MIN_ALIGNMENT) {
    return {
      passed: false,
      reason: `Interview alignment ${(alignmentScore * 100).toFixed(0)}% below minimum ${(INTERVIEW_MIN_ALIGNMENT * 100).toFixed(0)}%. Mutation blocked.`,
    };
  }

  return { passed: true };
}

/**
 * Identity Governor Check
 * Prevents fragmentation and over-specialization
 */
function checkIdentityStability(
  fragmentation: number,
  mutationCount: number
): { passed: boolean; reason?: string } {
  const MAX_FRAGMENTATION = 0.35;
  const MAX_MUTATIONS_PER_WINDOW = 5; // Per 24-hour window

  if (fragmentation > MAX_FRAGMENTATION) {
    return {
      passed: false,
      reason: `Identity fragmentation ${(fragmentation * 100).toFixed(0)}% exceeds threshold ${(MAX_FRAGMENTATION * 100).toFixed(0)}%. Mutation blocked.`,
    };
  }

  if (mutationCount > MAX_MUTATIONS_PER_WINDOW) {
    return {
      passed: false,
      reason: `Mutation rate exceeded ${MAX_MUTATIONS_PER_WINDOW} per 24h window (${mutationCount} detected). Cooldown enforced.`,
    };
  }

  return { passed: true };
}

/**
 * Credibility Governor Check
 * Assesses recruiter suspicion and background check risk
 */
function checkCredibility(
  recruiterSuspicionRisk: number,
  resume: ResumeArtifact
): { passed: boolean; reason?: string } {
  const MAX_SUSPICION_RISK = 0.4;

  if (recruiterSuspicionRisk > MAX_SUSPICION_RISK) {
    return {
      passed: false,
      reason: `Recruiter suspicion risk ${(recruiterSuspicionRisk * 100).toFixed(0)}% exceeds ${(MAX_SUSPICION_RISK * 100).toFixed(0)}%. Mutation blocked to preserve credibility.`,
    };
  }

  return { passed: true };
}

/**
 * ATS Optimization Governor Check
 * Prevents mutation pressure from outpacing safe optimization velocity.
 */
function checkAtsOptimization(
  mutationCount: number,
  alignmentScore: number,
  fragmentation: number
): { passed: boolean; reason?: string } {
  const MAX_MUTATION_PRESSURE = 7;

  if (mutationCount > MAX_MUTATION_PRESSURE && alignmentScore < 0.75) {
    return {
      passed: false,
      reason: `ATS mutation pressure too high (${mutationCount}) for current alignment ${(alignmentScore * 100).toFixed(0)}%`,
    };
  }

  if (fragmentation > 0.3 && mutationCount > 5) {
    return {
      passed: false,
      reason: `ATS mutation pressure (${mutationCount}) amplifies fragmentation risk ${(fragmentation * 100).toFixed(0)}%`,
    };
  }

  return { passed: true };
}

/**
 * Main Governance Gate
 * Requires 3+ governor approvals before ANY resume mutation
 * If 2+ reject: mutation is BLOCKED
 */
export function evaluateMutationApproval(
  resume: ResumeArtifact,
  governanceState: GovernanceState,
  interviewContext?: InterviewContext
): GovernanceCheckpoint {
  const checkpoint: GovernanceCheckpoint = {
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
  };

  // Emergency freeze check
  if (governanceState.emergencyFreeze) {
    checkpoint.mutationFrozen = true;
    checkpoint.blockingReasons.push("System is in emergency freeze mode due to governance breach");
    return checkpoint;
  }

  // Frozen until date check
  if (governanceState.frozenUntil && new Date() < governanceState.frozenUntil) {
    checkpoint.mutationFrozen = true;
    checkpoint.blockingReasons.push(
      `System frozen until ${governanceState.frozenUntil.toISOString()}. Cooldown in effect.`
    );
    return checkpoint;
  }

  // Governor 1: Realism
  const realismCheck = checkRealismFloor(governanceState.realismScore, resume);
  checkpoint.realismCheckPassed = realismCheck.passed;
  if (realismCheck.passed) {
    checkpoint.approvalCount++;
    checkpoint.governorVotes.push({ governor: "Realism", vote: "approve" });
  } else {
    checkpoint.rejectionCount++;
    checkpoint.governorVotes.push({ governor: "Realism", vote: "reject", reason: realismCheck.reason });
    checkpoint.blockingReasons.push(`[Realism Governor] ${realismCheck.reason}`);
  }

  // Governor 2: Interview Alignment
  const interviewCheck = checkInterviewAlignment(governanceState.alignmentScore, interviewContext);
  checkpoint.interviewCheckPassed = interviewCheck.passed;
  if (interviewCheck.passed) {
    checkpoint.approvalCount++;
    checkpoint.governorVotes.push({ governor: "Interview Alignment", vote: "approve" });
  } else {
    checkpoint.rejectionCount++;
    checkpoint.governorVotes.push({ governor: "Interview Alignment", vote: "reject", reason: interviewCheck.reason });
    checkpoint.blockingReasons.push(`[Interview Governor] ${interviewCheck.reason}`);
  }

  // Governor 3: Identity Stability
  const identityCheck = checkIdentityStability(governanceState.fragmentation, governanceState.mutations);
  checkpoint.identityCheckPassed = identityCheck.passed;
  if (identityCheck.passed) {
    checkpoint.approvalCount++;
    checkpoint.governorVotes.push({ governor: "Identity Cohesion", vote: "approve" });
  } else {
    checkpoint.rejectionCount++;
    checkpoint.governorVotes.push({ governor: "Identity Cohesion", vote: "reject", reason: identityCheck.reason });
    checkpoint.blockingReasons.push(`[Identity Governor] ${identityCheck.reason}`);
  }

  // Governor 4: Credibility
  const credibilityCheck = checkCredibility(governanceState.recruiterSuspicionRisk, resume);
  checkpoint.credibilityCheckPassed = credibilityCheck.passed;
  if (credibilityCheck.passed) {
    checkpoint.approvalCount++;
    checkpoint.governorVotes.push({ governor: "Credibility", vote: "approve" });
  } else {
    checkpoint.rejectionCount++;
    checkpoint.governorVotes.push({ governor: "Credibility", vote: "reject", reason: credibilityCheck.reason });
    checkpoint.blockingReasons.push(`[Credibility Governor] ${credibilityCheck.reason}`);
  }

  // Governor 5: ATS Optimization Pressure
  const atsOptimizationCheck = checkAtsOptimization(
    governanceState.mutations,
    governanceState.alignmentScore,
    governanceState.fragmentation
  );
  checkpoint.atsOptimizationCheckPassed = atsOptimizationCheck.passed;
  if (atsOptimizationCheck.passed) {
    checkpoint.approvalCount++;
    checkpoint.governorVotes.push({ governor: "ATS Optimization", vote: "approve" });
  } else {
    checkpoint.rejectionCount++;
    checkpoint.governorVotes.push({ governor: "ATS Optimization", vote: "reject", reason: atsOptimizationCheck.reason });
    checkpoint.blockingReasons.push(`[ATS Governor] ${atsOptimizationCheck.reason}`);
  }

  // Consensus rule: if two or more reject, mutation is blocked.
  checkpoint.overallApproved = checkpoint.rejectionCount < 2;

  // If mutation is blocked, trigger cooldown
  if (!checkpoint.overallApproved) {
    checkpoint.mutationFrozen = true;

    // Calculate cooldown duration based on rejection severity
    const cooldownMinutes = Math.min(30, checkpoint.rejectionCount * 10);
    const frozenUntil = new Date();
    frozenUntil.setMinutes(frozenUntil.getMinutes() + cooldownMinutes);

    checkpoint.blockingReasons.push(
      `Mutation blocked by ${checkpoint.rejectionCount} governor(s). Cooldown: ${cooldownMinutes} minutes.`
    );
  }

  return checkpoint;
}

/**
 * Adaptive Cooldown Multiplier
 * Reduces adaptation speed as alignment score drops
 * alignmentScore > 80: 1.0 (normal speed)
 * alignmentScore > 60: 0.5 (half speed)
 * alignmentScore ≤ 60: 0.25 (quarter speed)
 */
export function calculateAdaptationMultiplier(alignmentScore: number): number {
  if (alignmentScore > 80) {
    return 1.0; // Full speed
  }

  if (alignmentScore > 60) {
    return 0.5; // Half speed
  }

  return 0.25; // Quarter speed (conservative)
}

/**
 * Memory Weight Decay
 * Older ATS optimizations lose influence over time
 * Prevents recursive keyword inflation
 * decay_factor = 0.95 per cycle
 */
export function applyMemoryWeightDecay(
  historicalWeight: number,
  cyclesSinceOptimization: number,
  decayFactor: number = 0.95
): number {
  // new_weight = old_weight × (decay_factor ^ cycles_elapsed)
  const decayedWeight = historicalWeight * Math.pow(decayFactor, cyclesSinceOptimization);

  // Minimum weight floor (prevent complete erasure)
  const MIN_WEIGHT = 0.01;
  return Math.max(MIN_WEIGHT, decayedWeight);
}

/**
 * Escalation Handler
 * Triggers emergency freeze if multiple governors consistently reject
 */
export function checkEscalationThreshold(
  recentCheckpoints: GovernanceCheckpoint[],
  threshold: number = 0.7
): { escalated: boolean; reason?: string } {
  if (recentCheckpoints.length === 0) {
    return { escalated: false };
  }

  const rejectionRate = recentCheckpoints.filter((cp) => !cp.overallApproved).length / recentCheckpoints.length;

  if (rejectionRate > threshold) {
    return {
      escalated: true,
      reason: `Rejection rate ${(rejectionRate * 100).toFixed(0)}% exceeds escalation threshold ${(threshold * 100).toFixed(0)}%. Emergency freeze triggered.`,
    };
  }

  return { escalated: false };
}

/**
 * Governor Status Summary
 * For monitoring and debugging
 */
export function summarizeGovernanceStatus(
  checkpoint: GovernanceCheckpoint,
  state: GovernanceState
): string {
  const governors = [
    { name: "Realism", passed: checkpoint.realismCheckPassed },
    { name: "Interview", passed: checkpoint.interviewCheckPassed },
    { name: "Identity", passed: checkpoint.identityCheckPassed },
    { name: "Credibility", passed: checkpoint.credibilityCheckPassed },
  ];

  const statusLine = governors.map((g) => `${g.name}: ${g.passed ? "✓" : "✗"}`).join(" | ");

  return [
    statusLine,
    `Consensus: ${checkpoint.overallApproved ? "APPROVED" : "BLOCKED"} (${checkpoint.approvalCount}/4 approvals)`,
    `Realism: ${(state.realismScore * 100).toFixed(0)}% | Alignment: ${(state.alignmentScore * 100).toFixed(0)}% | Fragmentation: ${(state.fragmentation * 100).toFixed(0)}%`,
    `Suspicion Risk: ${(state.recruiterSuspicionRisk * 100).toFixed(0)}% | Mutations: ${state.mutations}`,
    checkpoint.mutationFrozen ? "🔒 FROZEN" : "🔓 Active",
  ].join("\n");
}
