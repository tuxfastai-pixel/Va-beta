/**
 * Recruiter Suspicion Risk Scoring
 * Estimates the likelihood that a recruiter will perceive inconsistency
 * during the interview, application review, or background check process
 *
 * Used for:
 * - Adaptive throttling of applications
 * - Resume positioning decisions
 * - Real-time interview assistance calibration
 * - Governance risk flags
 */

import type { DriftAnalysis, DriftTrend } from "@/lib/governance/interviewDriftEngine";
import type { ResumeArtifact } from "@/lib/resume/resumeGenerator";

export interface SuspicionIndicator {
  category: string;
  signal: string;
  weight: number;
  severity: "low" | "medium" | "high" | "critical";
  mitigation?: string;
}

export interface RecruiterSuspicionRisk {
  userId: string;
  overallRiskScore: number;
  riskLevel: "MINIMAL" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";
  primaryIndicators: SuspicionIndicator[];
  resumeRisks: SuspicionIndicator[];
  interviewRisks: SuspicionIndicator[];
  backgroundCheckRisks: SuspicionIndicator[];
  recommendedActions: string[];
  throttleMultiplier: number; // 1.0 = normal, 0.5 = half speed, 0.1 = near pause
  deploymentSafetyWindow: "SAFE" | "CAUTION" | "RISKY" | "BLOCKED";
  timestamp: Date;
}

/**
 * Analyze resume for common suspicion triggers
 */
function analyzeResumeRisks(resume: ResumeArtifact): SuspicionIndicator[] {
  const indicators: SuspicionIndicator[] = [];
  const text = resume.text.toLowerCase();

  // Keyword inflation detection
  const inflationKeywords = [
    { keyword: "led", pattern: /led\s+(?:multiple|several|various|large|complex)/gi, weight: 0.15 },
    { keyword: "spearheaded", pattern: /spearheaded/gi, weight: 0.12 },
    { keyword: "revolutionized", pattern: /revolutionized/gi, weight: 0.15 },
    { keyword: "transformed", pattern: /transformed/gi, weight: 0.1 },
    { keyword: "optimization", pattern: /(?:achieved|delivered|realized)\s+\d+%\s+(?:improvement|increase|growth)/gi, weight: 0.12 },
  ];

  for (const { keyword, pattern, weight } of inflationKeywords) {
    if (text.match(pattern)) {
      indicators.push({
        category: "keyword_inflation",
        signal: `Overuse of "${keyword}" or similar power words suggesting embellishment`,
        weight,
        severity: weight > 0.13 ? "high" : "medium",
        mitigation: `Replace with specific, measurable accomplishments`,
      });
    }
  }

  // Vague responsibility indicators
  if (text.match(/responsible for|contributed to|involved in|worked on/gi)) {
    const vaguenessCount = (text.match(/responsible for|contributed to|involved in|worked on/gi) || []).length;
    if (vaguenessCount > 5) {
      indicators.push({
        category: "vague_claims",
        signal: `${vaguenessCount} vague responsibility claims without specific impact`,
        weight: 0.2,
        severity: "high",
        mitigation: "Replace vague claims with specific achievements and metrics",
      });
    }
  }

  // Skill over-breadth (claiming expertise in too many areas)
  const skillCounts = (text.match(/proficient|expert|master|advanced/gi) || []).length;
  if (skillCounts > 15) {
    indicators.push({
      category: "skill_breadth",
      signal: `Claims expertise in ${skillCounts}+ areas (over-specialization risk)`,
      weight: 0.18,
      severity: "high",
      mitigation: "Focus on 3-4 core specializations with depth",
    });
  }

  // Timeline gaps or compression
  if (text.match(/\d+-\d+ years?.*\d+-\d+ years?.*\d+-\d+ years?/gi)) {
    const compressedRoles = (text.match(/\d+-\d+ years?/gi) || []).length;
    if (compressedRoles > 6) {
      indicators.push({
        category: "timeline_compression",
        signal: `${compressedRoles} roles listed (rapid job changes suggest shallow experience)`,
        weight: 0.22,
        severity: "high",
        mitigation: "Consider focusing on most relevant/longest tenure roles",
      });
    }
  }

  // Certification inflation
  if (text.match(/certified|certification|certified professional/gi)) {
    const certCount = (text.match(/certified|certification|certified professional/gi) || []).length;
    if (certCount > 5) {
      indicators.push({
        category: "certification_inflation",
        signal: `${certCount} certifications claimed (possible credential embellishment)`,
        weight: 0.25,
        severity: "high",
        mitigation: "Include only verifiable, relevant certifications with issue dates",
      });
    }
  }

  return indicators;
}

/**
 * Analyze interview performance for suspicion triggers
 */
function analyzeInterviewRisks(
  driftAnalysis: DriftAnalysis,
  performanceData?: {
    questionAccuracy: number;
    technicalCorrectness: number;
    consistencyScore: number;
  }
): SuspicionIndicator[] {
  const indicators: SuspicionIndicator[] = [];

  // High terminology mismatch
  if (driftAnalysis.terminology.mismatchRisk > 0.5) {
    indicators.push({
      category: "terminology_mismatch",
      signal: `Candidate claims expertise but demonstrates weak terminology knowledge (risk: ${(driftAnalysis.terminology.mismatchRisk * 100).toFixed(0)}%)`,
      weight: 0.35,
      severity: "critical",
      mitigation: "Prepare deep technical knowledge for claimed specializations",
    });
  }

  // High hesitation/uncertainty
  if (driftAnalysis.confidence.directAnswerRate < 0.4) {
    indicators.push({
      category: "hesitation_patterns",
      signal: `Frequent hesitation and uncertainty in responses (direct answer rate: ${(driftAnalysis.confidence.directAnswerRate * 100).toFixed(0)}%)`,
      weight: 0.25,
      severity: "high",
      mitigation: "Practice confident delivery of known material",
    });
  }

  // Workflow experience inconsistency
  if (driftAnalysis.workflow.inconsistencies.length > 0) {
    indicators.push({
      category: "experience_inconsistency",
      signal: `Claims don't match demonstrated experience: ${driftAnalysis.workflow.inconsistencies[0]}`,
      weight: driftAnalysis.workflow.mismatchRisk > 0.4 ? 0.4 : 0.3,
      severity: driftAnalysis.workflow.mismatchRisk > 0.4 ? "critical" : "high",
      mitigation: "Align resume claims with actual demonstrated capabilities",
    });
  }

  // Realism credibility issues
  if (!driftAnalysis.realism.credibilityIndicators.believable) {
    indicators.push({
      category: "credibility",
      signal: `Overall credibility concerns (realism score: ${(driftAnalysis.realism.score * 100).toFixed(0)}%)`,
      weight: 0.35,
      severity: "critical",
      mitigation: "Reposition resume to reflect realistic capability level",
    });
  }

  // Overstatement risk
  if (driftAnalysis.realism.credibilityIndicators.overstatementRisk > 0.6) {
    indicators.push({
      category: "overstatement",
      signal: `High likelihood of resume overstatement detected (${(driftAnalysis.realism.credibilityIndicators.overstatementRisk * 100).toFixed(0)}% overstatement risk)`,
      weight: 0.3,
      severity: "high",
      mitigation: "Conservative positioning for next applications",
    });
  }

  // Technical accuracy issues (if provided)
  if (performanceData && performanceData.technicalCorrectness < 0.6) {
    indicators.push({
      category: "technical_accuracy",
      signal: `Multiple technical inaccuracies in responses (accuracy: ${(performanceData.technicalCorrectness * 100).toFixed(0)}%)`,
      weight: 0.28,
      severity: "high",
      mitigation: "Increase technical preparation for claimed domain expertise",
    });
  }

  return indicators;
}

/**
 * Analyze background check and verification risks
 */
function analyzeBackgroundCheckRisks(
  resume: ResumeArtifact,
  driftTrend?: DriftTrend
): SuspicionIndicator[] {
  const indicators: SuspicionIndicator[] = [];

  // High variation across resume variants suggests unstable identity
  if (driftTrend && driftTrend.riskLevelProgression.filter(r => r === "HIGH" || r === "CRITICAL").length > driftTrend.riskLevelProgression.length * 0.4) {
    indicators.push({
      category: "identity_instability",
      signal: `High proportion of concerning interview alignments (${Math.round(driftTrend.riskLevelProgression.filter(r => r === "HIGH" || r === "CRITICAL").length / driftTrend.riskLevelProgression.length * 100)}%)`,
      weight: 0.32,
      severity: "high",
      mitigation: "Stabilize identity and maintain consistent positioning",
    });
  }

  // Unverifiable claims
  const unverifiablePatterns = [
    { pattern: /\battempted\b.*\bproject\b/gi, claim: "attempted projects (unverifiable)" },
    { pattern: /\binvolved\b.*\bstartup\b.*\bno longer exists\b/gi, claim: "startup experience (unverifiable)" },
    { pattern: /\bprivate\s+consulting\b/gi, claim: "private consulting (hard to verify)" },
  ];

  for (const { pattern, claim } of unverifiablePatterns) {
    if (resume.text.match(pattern)) {
      indicators.push({
        category: "unverifiable_claims",
        signal: `Contains ${claim}`,
        weight: 0.2,
        severity: "medium",
        mitigation: "Include verifiable employment and projects only",
      });
    }
  }

  return indicators;
}

/**
 * Calculate overall suspicion risk score
 */
function calculateSuspicionScore(
  resumeRisks: SuspicionIndicator[],
  interviewRisks: SuspicionIndicator[],
  backgroundRisks: SuspicionIndicator[],
  driftAnalysis?: DriftAnalysis
): number {
  // Weighted combination of all risk categories
  let score = 0;
  let totalWeight = 0;

  for (const indicator of [...resumeRisks, ...interviewRisks, ...backgroundRisks]) {
    score += indicator.weight;
    totalWeight += 1;
  }

  // Normalize to 0-1 scale
  const baseScore = Math.min(1.0, score / Math.max(totalWeight, 1));

  // Apply drift analysis weight if available
  if (driftAnalysis) {
    const driftFactor = driftAnalysis.recruiterPerceptionRisk * 0.3;
    return Math.min(1.0, baseScore * 0.7 + driftFactor);
  }

  return baseScore;
}

/**
 * Determine throttle multiplier based on risk level
 */
function calculateThrottleMultiplier(riskScore: number, driftTrend?: DriftTrend): number {
  let multiplier = 1.0;

  if (riskScore < 0.2) {
    multiplier = 1.0; // Normal speed
  } else if (riskScore < 0.35) {
    multiplier = 0.8; // Slight caution
  } else if (riskScore < 0.5) {
    multiplier = 0.6; // Moderate throttle
  } else if (riskScore < 0.65) {
    multiplier = 0.3; // Heavy throttle
  } else {
    multiplier = 0.05; // Near pause
  }

  // Further reduce if drift trend shows degradation
  if (driftTrend?.alignmentTrend === "degrading") {
    multiplier *= 0.7;
  }

  return multiplier;
}

/**
 * Determine if deployment is safe
 */
function getDeploymentSafetyWindow(riskScore: number, primaryIndicators: SuspicionIndicator[]): RecruiterSuspicionRisk["deploymentSafetyWindow"] {
  const criticalIndicators = primaryIndicators.filter(i => i.severity === "critical");

  if (criticalIndicators.length > 0) return "BLOCKED";
  if (riskScore > 0.65) return "RISKY";
  if (riskScore > 0.45) return "CAUTION";
  return "SAFE";
}

/**
 * Generate mitigation recommendations
 */
function generateMitigationActions(
  resumeRisks: SuspicionIndicator[],
  interviewRisks: SuspicionIndicator[],
  backgroundRisks: SuspicionIndicator[],
  riskLevel: RecruiterSuspicionRisk["riskLevel"]
): string[] {
  const actions: string[] = [];

  // Priority-based recommendations
  if (riskLevel === "SEVERE" || riskLevel === "HIGH") {
    actions.push("⚠️ PAUSE DEPLOYMENTS: Complete resume and interview prep revision before further applications");
  }

  // Resume-specific
  if (resumeRisks.filter(r => r.severity === "critical").length > 0) {
    actions.push("🔴 Resume: Remove inflation keywords and vague claims. Use specific, verifiable accomplishments.");
  }

  // Interview-specific
  if (interviewRisks.filter(r => r.severity === "critical").length > 0) {
    actions.push("🔴 Interview: Intensive preparation needed. Address terminology gaps and confidence issues.");
  }

  // Background check
  if (backgroundRisks.length > 0) {
    actions.push("🟡 Ensure all claims are verifiable with documentation ready for reference checks");
  }

  // General recommendations
  if (riskLevel === "MODERATE") {
    actions.push("🟡 Reduce application frequency by 40%. Focus on quality over quantity.");
    actions.push("🟡 Request interview prep assistance before all calls");
  }

  if (riskLevel === "LOW") {
    actions.push("✅ Monitor metrics. Maintain current positioning strategy.");
  }

  return actions;
}

/**
 * Core suspicion risk assessment
 */
export function assessRecruiterSuspicionRisk(
  resume: ResumeArtifact,
  driftAnalysis?: DriftAnalysis,
  driftTrend?: DriftTrend,
  userId?: string
): RecruiterSuspicionRisk {
  // Analyze each dimension
  const resumeRisks = analyzeResumeRisks(resume);
  const interviewRisks = driftAnalysis ? analyzeInterviewRisks(driftAnalysis) : [];
  const backgroundRisks = analyzeBackgroundCheckRisks(resume, driftTrend);

  // Combine all indicators and sort by weight
  const allIndicators = [...resumeRisks, ...interviewRisks, ...backgroundRisks];
  const primaryIndicators = allIndicators
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  // Calculate overall risk score
  const overallRiskScore = calculateSuspicionScore(
    resumeRisks,
    interviewRisks,
    backgroundRisks,
    driftAnalysis
  );

  // Determine risk level
  let riskLevel: RecruiterSuspicionRisk["riskLevel"] = "MINIMAL";
  if (overallRiskScore < 0.15) riskLevel = "MINIMAL";
  else if (overallRiskScore < 0.3) riskLevel = "LOW";
  else if (overallRiskScore < 0.5) riskLevel = "MODERATE";
  else if (overallRiskScore < 0.7) riskLevel = "HIGH";
  else riskLevel = "SEVERE";

  // Calculate throttle multiplier
  const throttleMultiplier = calculateThrottleMultiplier(overallRiskScore, driftTrend);

  // Determine safety window
  const deploymentSafetyWindow = getDeploymentSafetyWindow(overallRiskScore, primaryIndicators);

  // Generate recommendations
  const recommendedActions = generateMitigationActions(
    resumeRisks,
    interviewRisks,
    backgroundRisks,
    riskLevel
  );

  return {
    userId: userId || "unknown",
    overallRiskScore,
    riskLevel,
    primaryIndicators,
    resumeRisks,
    interviewRisks,
    backgroundCheckRisks: backgroundRisks,
    recommendedActions,
    throttleMultiplier,
    deploymentSafetyWindow,
    timestamp: new Date(),
  };
}

/**
 * Real-time interview assistance calibration
 * Returns guidance for live assistance mode
 */
export function getInterviewAssistanceCalibration(
  suspicionRisk: RecruiterSuspicionRisk,
  driftAnalysis?: DriftAnalysis
) {
  return {
    assistanceLevel: suspicionRisk.riskLevel === "SEVERE" || suspicionRisk.riskLevel === "HIGH" ? "INTENSIVE" : "STANDARD",
    focusAreas: driftAnalysis?.recommendations.slice(0, 3) || [],
    warningFlags: suspicionRisk.primaryIndicators.map(i => i.signal),
    suggestPause: suspicionRisk.deploymentSafetyWindow === "BLOCKED",
    confidenceThreshold: suspicionRisk.riskLevel === "SEVERE" ? 0.8 : 0.6,
  };
}
