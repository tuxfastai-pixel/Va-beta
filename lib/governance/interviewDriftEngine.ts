/**
 * Interview Drift Engine
 * Monitors terminology, workflow, confidence, and realism consistency
 * between deployed resume identity and interview performance
 *
 * Critical for:
 * - Detecting recruiter suspicion triggers
 * - Real-time interview assistance calibration
 * - Adaptive resume adjustments
 * - Governance integrity checks
 */

import type { ResumeArtifact } from "@/lib/resume/resumeGenerator";

export interface InterviewPerformance {
  userId: string;
  resumeVariantUsed: string;
  interviewTranscript: string;
  jobDescription: string;
  duration: number;
  stage: string;
  terminologyUsed: string[];
  confidenceIndicators: {
    hesitationPatterns: number;
    clarificationRequests: number;
    directAnswerRate: number;
  };
  companyContext?: {
    industry: string;
    size: string;
    focusAreas: string[];
  };
}

export interface DriftAnalysis {
  alignmentScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  terminology: {
    mismatchRisk: number;
    gaps: string[];
    unexpectedStrength: string[];
  };
  workflow: {
    mismatchRisk: number;
    claimedVsPerformedGaps: string[];
    inconsistencies: string[];
  };
  confidence: {
    mismatchRisk: number;
    hesitationPatterns: number;
    clarificationRequests: number;
    directAnswerRate: number;
    hesitationRedFlags: string[];
    strongAreas: string[];
    weakAreas: string[];
  };
  realism: {
    score: number;
    warningFlags: string[];
    credibilityIndicators: {
      believable: boolean;
      recruiterSuspicionLikelihood: number;
      overstatementRisk: number;
    };
  };
  recommendations: string[];
  recruiterPerceptionRisk: number;
}

/**
 * Extract key terminology and concepts from interview transcript
 */
function extractInterviewTerminology(transcript: string): string[] {
  const terms: string[] = [];

  // Extract technical terms, tools, methodologies mentioned
  const patterns = [
    /\b(API|REST|SQL|JavaScript|TypeScript|React|Node|database|cloud|AWS|Azure|GCP)\b/gi,
    /\b(workflow|process|automation|integration|pipeline|deployment|testing|CI\/CD)\b/gi,
    /\b(agile|sprint|kanban|scrum|waterfall|lean)\b/gi,
    /\b(leadership|management|delegation|mentoring|coaching)\b/gi,
    /\b(communication|collaboration|teamwork|negotiation)\b/gi,
    /\b(analysis|reporting|metrics|KPI|ROI|forecasting)\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = transcript.match(pattern);
    if (matches) {
      terms.push(...matches.map(m => m.toLowerCase()));
    }
  }

  return [...new Set(terms)];
}

/**
 * Extract terminology and concepts from resume text
 */
function extractResumeTerminology(resumeText: string): string[] {
  // Same patterns as interview extraction for consistency
  const patterns = [
    /\b(API|REST|SQL|JavaScript|TypeScript|React|Node|database|cloud|AWS|Azure|GCP)\b/gi,
    /\b(workflow|process|automation|integration|pipeline|deployment|testing|CI\/CD)\b/gi,
    /\b(agile|sprint|kanban|scrum|waterfall|lean)\b/gi,
    /\b(leadership|management|delegation|mentoring|coaching)\b/gi,
    /\b(communication|collaboration|teamwork|negotiation)\b/gi,
    /\b(analysis|reporting|metrics|KPI|ROI|forecasting)\b/gi,
  ];

  const terms: string[] = [];
  for (const pattern of patterns) {
    const matches = resumeText.match(pattern);
    if (matches) {
      terms.push(...matches.map(m => m.toLowerCase()));
    }
  }

  return [...new Set(terms)];
}

/**
 * Analyze terminology consistency between resume and interview
 */
function analyzeTerminologyMismatch(
  resumeTerms: string[],
  interviewTerms: string[]
): { mismatchRisk: number; gaps: string[]; unexpectedStrength: string[] } {
  const resumeSet = new Set(resumeTerms);

  // Terms claimed in resume but not demonstrated in interview
  const gaps = resumeTerms.filter(t => !new Set(interviewTerms).has(t));

  // Terms used in interview but not claimed in resume (could be suspicious or demonstrate growth)
  const unexpectedStrength = interviewTerms.filter(t => !resumeSet.has(t));

  // Risk calculation: How many resume claims weren't demonstrated?
  const mismatchRisk = resumeTerms.length > 0
    ? gaps.length / resumeTerms.length
    : 0;

  return {
    mismatchRisk: Math.min(mismatchRisk, 1.0),
    gaps,
    unexpectedStrength,
  };
}

/**
 * Detect hesitation, uncertainty, and confidence patterns
 */
function analyzeConfidencePattern(transcript: string): {
  hesitationPatterns: number;
  clarificationRequests: number;
  directAnswerRate: number;
} {
  const hesitationMarkers = [
    /\buh\b/gi,
    /\bumm?\b/gi,
    /\blike\b/gi,
    /\bsort of\b/gi,
    /\bkind of\b/gi,
    /\bmaybe\b/gi,
    /\bi think\b/gi,
    /\bprobably\b/gi,
    /\bnot sure\b/gi,
    /\bi'm not\s+(sure|confident|clear)\b/gi,
  ];

  const clarificationMarkers = [
    /\bcan you (clarify|repeat|rephrase)\b/gi,
    /\bwhat do you mean\b/gi,
    /\bcould you explain\b/gi,
    /\bwait, let me think\b/gi,
  ];

  let hesitationCount = 0;
  for (const marker of hesitationMarkers) {
    const matches = transcript.match(marker);
    hesitationCount += matches ? matches.length : 0;
  }

  let clarificationCount = 0;
  for (const marker of clarificationMarkers) {
    const matches = transcript.match(marker);
    clarificationCount += matches ? matches.length : 0;
  }

  // Approximate sentences/responses
  const responseSentences = transcript.split(/[.!?]+/).length;
  const directAnswerRate = Math.max(0, 1 - (hesitationCount / Math.max(responseSentences, 1)));

  return {
    hesitationPatterns: hesitationCount,
    clarificationRequests: clarificationCount,
    directAnswerRate: Math.max(0, directAnswerRate),
  };
}

/**
 * Detect workflow and experience mismatch signals
 */
function analyzeWorkflowMismatch(
  resumeText: string,
  transcript: string
): {
  mismatchRisk: number;
  claimedVsPerformedGaps: string[];
  inconsistencies: string[];
} {
  const inconsistencies: string[] = [];
  const claimedVsPerformedGaps: string[] = [];

  // Red flags for workflow mismatch
  if (resumeText.includes("leader") && transcript.match(/\bi don't\b.*\bexperience leading/i)) {
    inconsistencies.push("Claims leadership experience but demonstrates hesitation about leading");
    claimedVsPerformedGaps.push("leadership");
  }

  if (resumeText.includes("managed") && transcript.match(/\bi haven't.*manage/i)) {
    inconsistencies.push("Claims management experience but indicates lack of management background");
    claimedVsPerformedGaps.push("management");
  }

  if (
    (resumeText.includes("architecture") || resumeText.includes("design")) &&
    transcript.match(/\bi just.*implement.*others.*design/i)
  ) {
    inconsistencies.push("Claims design/architecture expertise but describes implementing others' designs");
    claimedVsPerformedGaps.push("system design");
  }

  if (
    resumeText.includes("full-stack") &&
    transcript.match(/\bi'm mainly.*frontend|mainly.*backend/i)
  ) {
    inconsistencies.push("Claims full-stack but describes specialization in one area");
    claimedVsPerformedGaps.push("full-stack credibility");
  }

  const mismatchRisk = (inconsistencies.length * 0.3) + (claimedVsPerformedGaps.length * 0.2);

  return {
    mismatchRisk: Math.min(mismatchRisk, 1.0),
    claimedVsPerformedGaps,
    inconsistencies,
  };
}

/**
 * Calculate realism credibility score
 */
function calculateRealismScore(
  transcript: string,
  confidenceMetrics: ReturnType<typeof analyzeConfidencePattern>,
  terminologyMismatch: ReturnType<typeof analyzeTerminologyMismatch>,
  workflowMismatch: ReturnType<typeof analyzeWorkflowMismatch>
): {
  score: number;
  warningFlags: string[];
  credibilityIndicators: {
    believable: boolean;
    recruiterSuspicionLikelihood: number;
    overstatementRisk: number;
  };
} {
  const warningFlags: string[] = [];
  let suspicionScore = 0;

  // Confidence metrics contribute to realism
  if (confidenceMetrics.hesitationPatterns > 10) {
    warningFlags.push("High hesitation pattern detected");
    suspicionScore += 0.2;
  }

  if (confidenceMetrics.directAnswerRate < 0.5) {
    warningFlags.push("Low direct answer rate suggests uncertainty");
    suspicionScore += 0.15;
  }

  // Terminology gaps suggest overstatement
  if (terminologyMismatch.mismatchRisk > 0.4) {
    warningFlags.push("Significant terminology gaps between resume claims and interview demonstration");
    suspicionScore += 0.25;
  }

  // Workflow mismatches are critical red flags
  if (workflowMismatch.mismatchRisk > 0.3) {
    warningFlags.push("Workflow experience inconsistencies detected");
    suspicionScore += 0.3;
  }

  // Check for overly polished/scripted responses (opposite problem)
  const genericResponses = (transcript.match(/i'm (confident|excited|committed|passionate)/gi) || []).length;
  if (genericResponses > 8) {
    warningFlags.push("Overly polished/scripted responses detected");
    suspicionScore += 0.15;
  }

  const realismScore = Math.max(0, 1.0 - suspicionScore);
  const recruiterSuspicionLikelihood = Math.min(1.0, suspicionScore);
  const overstatementRisk = terminologyMismatch.mismatchRisk;

  return {
    score: realismScore,
    warningFlags,
    credibilityIndicators: {
      believable: realismScore > 0.6,
      recruiterSuspicionLikelihood,
      overstatementRisk,
    },
  };
}

/**
 * Generate recommendations based on drift analysis
 */
function generateRecommendations(
  analysis: Omit<DriftAnalysis, "recommendations">
): string[] {
  const recommendations: string[] = [];

  if (analysis.alignmentScore < 0.5) {
    recommendations.push("CRITICAL: Resume and interview alignment significantly misaligned. Consider resume adjustment or interview preparation boost.");
  }

  if (analysis.terminology.mismatchRisk > 0.5) {
    recommendations.push("Add demonstration of key technical terms in interview prep or reduce emphasis in resume");
  }

  if (analysis.workflow.mismatchRisk > 0.4) {
    recommendations.push("Interview prep should focus on bridging claimed vs. demonstrated experience gaps");
  }

  if (analysis.confidence.hesitationRedFlags && analysis.confidence.hesitationRedFlags.length > 3) {
    recommendations.push("Practice concise, confident responses. Reduce hedging language.");
  }

  if (analysis.realism.credibilityIndicators.recruiterSuspicionLikelihood > 0.6) {
    recommendations.push("HIGH RECRUITER SUSPICION RISK: Adjust positioning or defer applications until alignment improves");
  }

  if (analysis.realism.credibilityIndicators.overstatementRisk > 0.5) {
    recommendations.push("Resume may overstate experience. Consider conservative positioning to match demonstrated capability.");
  }

  if (analysis.recruiterPerceptionRisk > 0.65) {
    recommendations.push("Activate anti-suspicion protocols: pause deployments, reduce variant frequency, focus on realistic positioning");
  }

  return recommendations;
}

/**
 * Core drift analysis function
 */
export function analyzeDrift(
  resumeArtifact: ResumeArtifact,
  performance: InterviewPerformance
): DriftAnalysis {
  // Extract terminology from both sources
  const resumeTerms = extractResumeTerminology(resumeArtifact.text);
  const interviewTerms = extractInterviewTerminology(performance.interviewTranscript);

  // Analyze each dimension
  const terminology = analyzeTerminologyMismatch(resumeTerms, interviewTerms);
  const confidence: DriftAnalysis["confidence"] = {
    mismatchRisk: 0,
    ...analyzeConfidencePattern(performance.interviewTranscript),
    hesitationRedFlags: [],
    strongAreas: [],
    weakAreas: [],
  };

  const workflow = analyzeWorkflowMismatch(resumeArtifact.text, performance.interviewTranscript);

  // Confidence hesitation flags
  if (confidence.hesitationPatterns > 10) {
    confidence.hesitationRedFlags.push(`High hesitation count: ${confidence.hesitationPatterns}`);
  }
  confidence.mismatchRisk = 1 - confidence.directAnswerRate;

  // Identify strong and weak areas
  const strongKeywords = interviewTerms.filter(t =>
    !performance.interviewTranscript.match(new RegExp(`\\b(?:uh|um|maybe|i think|not sure).*${t}\\b`, 'i'))
  );
  const weakKeywords = interviewTerms.filter(t =>
    performance.interviewTranscript.match(new RegExp(`\\b(?:uh|um|maybe|i think|not sure).*${t}\\b`, 'i'))
  );

  confidence.strongAreas = strongKeywords;
  confidence.weakAreas = weakKeywords;

  // Calculate realism score
  const realism = calculateRealismScore(
    performance.interviewTranscript,
    confidence,
    terminology,
    workflow
  );

  // Calculate overall alignment score
  const alignmentScore = (
    (1 - terminology.mismatchRisk) * 0.25 +
    (1 - confidence.mismatchRisk) * 0.25 +
    (1 - workflow.mismatchRisk) * 0.25 +
    realism.score * 0.25
  );

  // Determine risk level
  let riskLevel: DriftAnalysis["riskLevel"] = "LOW";
  if (alignmentScore < 0.3) riskLevel = "CRITICAL";
  else if (alignmentScore < 0.5) riskLevel = "HIGH";
  else if (alignmentScore < 0.7) riskLevel = "MEDIUM";

  // Calculate recruiter perception risk
  const recruiterPerceptionRisk = (
    (realism.credibilityIndicators.recruiterSuspicionLikelihood * 0.4) +
    (realism.credibilityIndicators.overstatementRisk * 0.3) +
    (1 - alignmentScore) * 0.3
  );

  const analysis: Omit<DriftAnalysis, "recommendations"> = {
    alignmentScore,
    riskLevel,
    terminology,
    workflow,
    confidence,
    realism,
    recruiterPerceptionRisk,
  };

  return {
    ...analysis,
    recommendations: generateRecommendations(analysis),
  };
}

/**
 * Track drift trend over multiple interviews
 */
export interface DriftTrend {
  userId: string;
  interviewCount: number;
  averageAlignmentScore: number;
  alignmentTrend: "improving" | "degrading" | "stable";
  riskLevelProgression: DriftAnalysis["riskLevel"][];
  latestAnalysis: DriftAnalysis;
  timestamp: Date;
}

export function trackDriftTrend(
  previousTrend: DriftTrend | null,
  latestAnalysis: DriftAnalysis,
  userId: string
): DriftTrend {
  if (!previousTrend) {
    return {
      userId,
      interviewCount: 1,
      averageAlignmentScore: latestAnalysis.alignmentScore,
      alignmentTrend: "stable",
      riskLevelProgression: [latestAnalysis.riskLevel],
      latestAnalysis,
      timestamp: new Date(),
    };
  }

  const newAverage = (
    (previousTrend.averageAlignmentScore * previousTrend.interviewCount + latestAnalysis.alignmentScore) /
    (previousTrend.interviewCount + 1)
  );

  const alignmentTrend: DriftTrend["alignmentTrend"] =
    newAverage > previousTrend.averageAlignmentScore ? "improving" :
    newAverage < previousTrend.averageAlignmentScore ? "degrading" :
    "stable";

  return {
    userId,
    interviewCount: previousTrend.interviewCount + 1,
    averageAlignmentScore: newAverage,
    alignmentTrend,
    riskLevelProgression: [...previousTrend.riskLevelProgression, latestAnalysis.riskLevel],
    latestAnalysis,
    timestamp: new Date(),
  };
}
