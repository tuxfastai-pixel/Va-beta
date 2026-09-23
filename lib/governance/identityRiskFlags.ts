/**
 * Identity Risk Flags System
 * Tracks over-specialization, ATS over-optimization, interview mismatch, and fragmentation risks
 * Critical for governance integrity and commercial credibility
 */

import type { DriftAnalysis, DriftTrend } from "@/lib/governance/interviewDriftEngine";
import type { RecruiterSuspicionRisk } from "@/lib/governance/recruiterSuspicionRisk";
import type { AlignmentTrend } from "@/lib/governance/alignmentTrend";

export interface IdentityRiskFlag {
  flagType:
    | "over_specialization"
    | "ats_over_optimization"
    | "interview_mismatch"
    | "identity_fragmentation"
    | "resume_inflation"
    | "capability_misalignment"
    | "market_positioning_drift"
    | "behavioral_inconsistency";
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: Date;
  reason: string;
  impact: string;
  mitigation: string;
  triggerThreshold?: number;
  currentValue?: number;
}

export interface IdentityRiskProfile {
  userId: string;
  flags: IdentityRiskFlag[];
  overallRiskScore: number; // 0-100
  riskLevel: "healthy" | "at_risk" | "critical";
  activeFlags: number;
  criticalFlags: number;
  recommendations: string[];
  lastUpdated: Date;
}

/**
 * Detect over-specialization risk
 */
function detectOverSpecializationRisk(
  operationTypes: string[],
  terminologyDiversity: number
): IdentityRiskFlag | null {
  // Over-specialization occurs when:
  // 1. Too few operation types (specializing too narrowly)
  // 2. Low terminology diversity (limited vocabulary)
  // 3. Rigid positioning that doesn't allow flexibility

  const specializationRatio = 1 / Math.max(operationTypes.length, 1);

  if (specializationRatio > 0.5 && terminologyDiversity < 0.4) {
    return {
      flagType: "over_specialization",
      severity: "high",
      detectedAt: new Date(),
      reason: `Excessive specialization: ${operationTypes.length} operation types, terminology diversity ${(terminologyDiversity * 100).toFixed(0)}%`,
      impact: "Limited market opportunities. Excludes many relevant positions due to narrow positioning.",
      mitigation: "Broaden positioning to adjacent operation types. Develop transferable skill narratives.",
      triggerThreshold: 0.5,
      currentValue: specializationRatio,
    };
  }

  return null;
}

/**
 * Detect ATS over-optimization risk
 */
function detectAtsOverOptimizationRisk(
  driftAnalysis: DriftAnalysis,
  alignmentTrend?: AlignmentTrend
): IdentityRiskFlag | null {
  // Over-optimization occurs when:
  // 1. High terminology gaps (optimized for keywords, not understanding)
  // 2. Declining interview alignment (ATS optimization hurting interview performance)
  // 3. Resume inflation without substance

  let riskIndicators = 0;
  let reason = "";

  if (driftAnalysis.terminology.mismatchRisk > 0.4) {
    riskIndicators++;
    reason += "High terminology gaps suggest ATS optimization without competency. ";
  }

  if (driftAnalysis.realism.credibilityIndicators.overstatementRisk > 0.6) {
    riskIndicators++;
    reason += "Resume overstatement indicates keyword inflation. ";
  }

  if (alignmentTrend && alignmentTrend.trend === "degrading") {
    riskIndicators++;
    reason += "Interview alignment degrading - optimization hurting real interactions. ";
  }

  if (riskIndicators >= 2) {
    return {
      flagType: "ats_over_optimization",
      severity: riskIndicators >= 3 ? "critical" : "high",
      detectedAt: new Date(),
      reason: reason.trim(),
      impact: "ATS improvements not converting to interviews. Risk of application spam perception.",
      mitigation:
        "Rebalance resume: prioritize authenticity over keyword density. Add semantic context instead of keyword stuffing.",
      triggerThreshold: 0.4,
      currentValue: driftAnalysis.terminology.mismatchRisk,
    };
  }

  return null;
}

/**
 * Detect interview mismatch risk
 */
function detectInterviewMismatchRisk(
  driftAnalysis: DriftAnalysis
): IdentityRiskFlag | null {
  // Interview mismatch occurs when:
  // 1. Resume claims don't match interview performance
  // 2. Workflow mismatches detected
  // 3. Confidence directly inversely correlated to claims

  const mismatchRisk =
    (driftAnalysis.workflow.mismatchRisk +
      driftAnalysis.terminology.mismatchRisk +
      (1 - driftAnalysis.confidence.directAnswerRate)) /
    3;

  if (mismatchRisk > 0.4) {
    return {
      flagType: "interview_mismatch",
      severity: mismatchRisk > 0.6 ? "critical" : "high",
      detectedAt: new Date(),
      reason: `Resume-interview misalignment detected: ${driftAnalysis.workflow.inconsistencies[0] || "Multiple inconsistencies"}`,
      impact: "Recruiters will detect inconsistencies. Offer conversion rates will decline. Trust damaged.",
      mitigation:
        "Align resume to actual capability level. Prepare deep technical knowledge for claimed areas.",
      triggerThreshold: 0.4,
      currentValue: mismatchRisk,
    };
  }

  return null;
}

/**
 * Detect identity fragmentation risk
 */
function detectIdentityFragmentationRisk(
  resumeVariants: Record<string, { callbackRate: number }>,
  applicationVolume: number
): IdentityRiskFlag | null {
  // Fragmentation occurs when:
  // 1. Multiple resume variants with wildly different callback rates
  // 2. Inconsistent positioning across platforms
  // 3. No clear primary identity

  if (Object.keys(resumeVariants).length < 2) return null;

  const callbackRates = Object.values(resumeVariants).map(r => r.callbackRate);
  const maxRate = Math.max(...callbackRates);
  const minRate = Math.min(...callbackRates);
  const variance = (maxRate - minRate) / Math.max(maxRate, 0.001);

  if (variance > 0.4 && applicationVolume > 100) {
    const bestVariant = Object.entries(resumeVariants).sort(
      ([, a], [, b]) => b.callbackRate - a.callbackRate
    )[0][0];

    return {
      flagType: "identity_fragmentation",
      severity: variance > 0.6 ? "critical" : "high",
      detectedAt: new Date(),
      reason: `Identity fragmentation: Resume variant callback rates vary by ${(variance * 100).toFixed(0)}%. Best performer: ${bestVariant}`,
      impact: "Scattered positioning dilutes market presence. Recruiters see inconsistent identity.",
      mitigation: `Consolidate around highest-performing variant (${bestVariant}). Retire underperforming variants.`,
      triggerThreshold: 0.4,
      currentValue: variance,
    };
  }

  return null;
}

/**
 * Detect resume inflation risk
 */
function detectResumeInflationRisk(
  suspicionRisk: RecruiterSuspicionRisk
): IdentityRiskFlag | null {
  if (suspicionRisk.riskLevel === "HIGH" || suspicionRisk.riskLevel === "SEVERE") {
    const inflationIndicators = suspicionRisk.resumeRisks
      .filter(r => r.severity === "high" || r.severity === "critical")
      .map(r => r.signal);

    if (inflationIndicators.length > 0) {
      return {
        flagType: "resume_inflation",
        severity: suspicionRisk.riskLevel === "SEVERE" ? "critical" : "high",
        detectedAt: new Date(),
        reason: `Resume inflation detected: ${inflationIndicators[0]}`,
        impact: "Recruiter suspicion high. Reference checks will contradict claims. Offer rescissions possible.",
        mitigation:
          "Remove power words and vague claims. Replace with specific, verifiable accomplishments with metrics.",
        triggerThreshold: 0.5,
        currentValue: suspicionRisk.overallRiskScore,
      };
    }
  }

  return null;
}

/**
 * Detect capability misalignment
 */
function detectCapabilityMisalignment(
  driftAnalysis: DriftAnalysis,
  realismTrend: number
): IdentityRiskFlag | null {
  // Misalignment when actual capability is lower than positioned capability

  if (
    driftAnalysis.realism.score < 0.5 &&
    realismTrend < 0 &&
    driftAnalysis.realism.credibilityIndicators.recruiterSuspicionLikelihood > 0.6
  ) {
    return {
      flagType: "capability_misalignment",
      severity: "critical",
      detectedAt: new Date(),
      reason: `Capability significantly below positioned level. Realism score ${(driftAnalysis.realism.score * 100).toFixed(0)}%`,
      impact:
        "Major mismatch between resume positioning and actual ability will be discovered in interviews. Severe credibility damage.",
      mitigation:
        "Immediately reposition resume to realistic capability level. Pause applications until alignment improves.",
      triggerThreshold: 0.5,
      currentValue: driftAnalysis.realism.score,
    };
  }

  return null;
}

/**
 * Detect market positioning drift
 */
function detectMarketPositioningDrift(
  previousProfile: IdentityRiskProfile | undefined,
  currentHeadlines: string[]
): IdentityRiskFlag | null {
  if (!previousProfile || previousProfile.flags.length === 0) return null;

  // Check if positioning is rapidly changing
  const positioningChanges = currentHeadlines.filter(h => {
    const hasDriftFlag = previousProfile.flags.some(
      f =>
        f.flagType === "market_positioning_drift" &&
        f.reason.includes(h)
    );
    return !hasDriftFlag;
  });

  if (positioningChanges.length > 2) {
    return {
      flagType: "market_positioning_drift",
      severity: "high",
      detectedAt: new Date(),
      reason: `Rapid positioning changes detected: ${positioningChanges.length} headline updates in short period`,
      impact: "Constant positioning changes signal unclear personal brand. Recruiters may perceive instability.",
      mitigation: "Stabilize positioning for 30 days. Let market respond to consistent messaging.",
      currentValue: positioningChanges.length,
    };
  }

  return null;
}

/**
 * Detect behavioral inconsistency
 */
function detectBehavioralInconsistency(
  alignmentTrend: AlignmentTrend,
  suspicionRisk: RecruiterSuspicionRisk
): IdentityRiskFlag | null {
  // Behavioral inconsistency when interview behavior changes significantly

  if (
    alignmentTrend.volatility > 0.35 &&
    alignmentTrend.trend === "degrading" &&
    suspicionRisk.riskLevel === "HIGH"
  ) {
    return {
      flagType: "behavioral_inconsistency",
      severity: "high",
      detectedAt: new Date(),
      reason: `Interview behavior highly inconsistent (volatility: ${(alignmentTrend.volatility * 100).toFixed(0)}%, degrading trend)`,
      impact: "Inconsistent interview performance suggests lack of mastery or nervousness. Reduces offer likelihood.",
      mitigation:
        "Standardize interview preparation. Practice consistent responses. Address underlying anxiety/preparation gaps.",
      triggerThreshold: 0.3,
      currentValue: alignmentTrend.volatility,
    };
  }

  return null;
}

/**
 * Build comprehensive identity risk profile
 */
export function buildIdentityRiskProfile(
  userId: string,
  driftAnalysis: DriftAnalysis,
  alignmentTrend: AlignmentTrend,
  suspicionRisk: RecruiterSuspicionRisk,
  metadata?: {
    operationTypes?: string[];
    terminologyDiversity?: number;
    resumeVariants?: Record<string, { callbackRate: number }>;
    applicationVolume?: number;
    marketHeadlines?: string[];
    previousProfile?: IdentityRiskProfile;
  }
): IdentityRiskProfile {
  const flags: IdentityRiskFlag[] = [];

  // Run all risk detections
  const operSpecRisk = detectOverSpecializationRisk(
    metadata?.operationTypes || [],
    metadata?.terminologyDiversity || 0
  );
  if (operSpecRisk) flags.push(operSpecRisk);

  const atsOptRisk = detectAtsOverOptimizationRisk(driftAnalysis, alignmentTrend);
  if (atsOptRisk) flags.push(atsOptRisk);

  const interviewRisk = detectInterviewMismatchRisk(driftAnalysis);
  if (interviewRisk) flags.push(interviewRisk);

  const fragmentationRisk = detectIdentityFragmentationRisk(
    metadata?.resumeVariants || {},
    metadata?.applicationVolume || 0
  );
  if (fragmentationRisk) flags.push(fragmentationRisk);

  const inflationRisk = detectResumeInflationRisk(suspicionRisk);
  if (inflationRisk) flags.push(inflationRisk);

  const capabilityRisk = detectCapabilityMisalignment(
    driftAnalysis,
    alignmentTrend.trendScore
  );
  if (capabilityRisk) flags.push(capabilityRisk);

  const positioningRisk = detectMarketPositioningDrift(
    metadata?.previousProfile,
    metadata?.marketHeadlines || []
  );
  if (positioningRisk) flags.push(positioningRisk);

  const behaviorRisk = detectBehavioralInconsistency(
    alignmentTrend,
    suspicionRisk
  );
  if (behaviorRisk) flags.push(behaviorRisk);

  // Calculate metrics
  const criticalFlagCount = flags.filter(f => f.severity === "critical").length;
  const highFlagCount = flags.filter(f => f.severity === "high").length;

  let overallRiskScore = 0;
  for (const flag of flags) {
    const severityWeight = {
      low: 10,
      medium: 30,
      high: 60,
      critical: 100,
    };
    overallRiskScore += severityWeight[flag.severity];
  }
  overallRiskScore = Math.min(100, overallRiskScore / Math.max(flags.length, 1));

  // Determine risk level
  let riskLevel: IdentityRiskProfile["riskLevel"] = "healthy";
  if (criticalFlagCount > 0) {
    riskLevel = "critical";
  } else if (highFlagCount > 1 || overallRiskScore > 65) {
    riskLevel = "at_risk";
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (riskLevel === "critical") {
    recommendations.push(
      `🔴 CRITICAL: ${criticalFlagCount} critical risk flags active. Immediate action required.`
    );
    recommendations.push(
      `⚠️ Recommendation: Pause deployments. Address all critical flags before continuing.`
    );
  } else if (riskLevel === "at_risk") {
    recommendations.push(
      `🟡 AT RISK: ${highFlagCount} high-severity flags detected.`
    );
    recommendations.push(`⚠️ Recommendation: Execute risk mitigation actions.`);
  } else {
    recommendations.push(`✅ HEALTHY: No major identity risks detected.`);
    recommendations.push(`📈 Continue monitoring alignment trends.`);
  }

  // Add specific mitigations from flags
  const criticalAndHighFlags = flags.filter(
    f => f.severity === "critical" || f.severity === "high"
  );
  for (const flag of criticalAndHighFlags.slice(0, 3)) {
    recommendations.push(`- ${flag.mitigation}`);
  }

  return {
    userId,
    flags,
    overallRiskScore: Math.round(overallRiskScore),
    riskLevel,
    activeFlags: flags.length,
    criticalFlags: criticalFlagCount,
    recommendations,
    lastUpdated: new Date(),
  };
}

/**
 * Export identity risk profile for dashboard
 */
export function exportIdentityRiskProfile(profile: IdentityRiskProfile) {
  return {
    userId: profile.userId,
    riskLevel: profile.riskLevel,
    overallRiskScore: profile.overallRiskScore,
    activeFlags: profile.activeFlags,
    criticalFlags: profile.criticalFlags,
    flagSummary: profile.flags.map(f => ({
      type: f.flagType,
      severity: f.severity,
      reason: f.reason,
      mitigation: f.mitigation,
      currentValue: f.currentValue,
    })),
    recommendations: profile.recommendations,
    lastUpdated: profile.lastUpdated.toISOString(),
  };
}
