/**
 * Phase 9B: Live Interview Assistance Layer
 * Real-time drift detection and intervention during live calls
 * Bridges governance, readiness, and mobile operations
 */

import { analyzeDrift } from "../governance/interviewDriftEngine.ts";
import { assessRecruiterSuspicionRisk } from "../governance/recruiterSuspicionRisk.ts";
import { assessOperationTypeReadiness } from "../governance/readinessConfidence.ts";
import { generateCompetencyHeatmap } from "../governance/terminologyHeatmap.ts";
import type { ResumeArtifact } from "../resume/resumeGenerator.ts";
import type { InterviewContext } from "../interview/interviewEngine.ts";

export interface LiveInterviewSession {
  sessionId: string;
  userId: string;
  interviewStartTime: Date;
  resume: ResumeArtifact;
  jobTitle: string;
  jobDescription: string;
  interviewStage: "phone_screen" | "technical" | "behavioral" | "final";
  recruiterName?: string;
  companyName?: string;
}

export interface InterviewTranscriptSegment {
  timestamp: Date;
  speaker: "candidate" | "recruiter";
  text: string;
  duration: number; // seconds
}

export interface LiveDriftAlert {
  severity: "info" | "warning" | "critical";
  category: "terminology" | "experience_gap" | "confidence" | "timeline" | "credibility";
  message: string;
  recommendation: string;
  requiredAction: boolean;
  timestamp: Date;
}

export interface TerminologySuggestion {
  context: string;
  missingTerms: string[];
  strongerAlternatives: { weak: string; stronger: string }[];
  domainFocus: string;
  confidence: number;
}

export interface LiveAssistanceContext {
  driftAnalysis: ReturnType<typeof analyzeDrift>;
  suspicionRisk: ReturnType<typeof assessRecruiterSuspicionRisk>;
  readinessAssessment: ReturnType<typeof assessOperationTypeReadiness>;
  competencyHeatmap: ReturnType<typeof generateCompetencyHeatmap>;
  alignmentTrend: number; // 0-1
  alerts: LiveDriftAlert[];
  suggestions: TerminologySuggestion[];
  confidenceModifier: number; // 1.0 = normal, <1.0 = needs support
}

/**
 * Detect Drift in Real-Time
 * Analyzes transcript segments as they accumulate
 */
export function detectRealtimeDrift(
  session: LiveInterviewSession,
  transcriptSegments: InterviewTranscriptSegment[],
  resume: ResumeArtifact
): LiveDriftAlert[] {
  const alerts: LiveDriftAlert[] = [];

  // Reconstruct interview context from transcript
  const fullTranscript = transcriptSegments.map((s) => s.text).join(" ");
  const candidateTranscript = transcriptSegments
    .filter((s) => s.speaker === "candidate")
    .map((s) => s.text)
    .join(" ");

  const interviewContext: InterviewContext = {
    userId: session.userId,
    resumeVariantUsed: resume.key,
    interviewTranscript: fullTranscript,
    jobDescription: session.jobDescription,
    duration: Math.round((transcriptSegments[transcriptSegments.length - 1]?.timestamp.getTime() || 0 - session.interviewStartTime.getTime()) / 1000),
    stage: session.interviewStage,
    terminologyUsed: extractTerminology(candidateTranscript),
    confidenceIndicators: {
      hesitationPatterns: countHesitations(candidateTranscript),
      clarificationRequests: countClarifications(candidateTranscript),
      directAnswerRate: calculateDirectAnswerRate(candidateTranscript),
    },
  };

  const drift = analyzeDrift(resume, interviewContext);

  // Generate alerts based on drift analysis
  if (drift.riskLevel === "HIGH" || drift.riskLevel === "CRITICAL") {
    alerts.push({
      severity: drift.riskLevel === "CRITICAL" ? "critical" : "warning",
      category: "credibility",
      message: `Alignment score ${(drift.alignmentScore * 100).toFixed(0)}%. Risk level: ${drift.riskLevel}.`,
      recommendation: "Focus on demonstrating claimed experience with specific examples.",
      requiredAction: drift.riskLevel === "CRITICAL",
      timestamp: new Date(),
    });
  }

  // Terminology gaps
  if (drift.terminology.mismatchRisk > 0.3) {
    alerts.push({
      severity: "warning",
      category: "terminology",
      message: `Missing key terminology from resume claims (${drift.terminology.gaps.slice(0, 3).join(", ")})`,
      recommendation: `Use terms like "${drift.terminology.gaps[0]}" to demonstrate expertise.`,
      requiredAction: true,
      timestamp: new Date(),
    });
  }

  // Confidence pattern issues
  if (drift.confidence.mismatchRisk > 0.35) {
    alerts.push({
      severity: "warning",
      category: "confidence",
      message: `Hesitation patterns detected. ${drift.confidence.hesitationCount} hesitations, ${drift.confidence.clarificationCount} clarification requests.`,
      recommendation: "Take a breath. Provide direct answers. Avoid 'um' and 'uh'.",
      requiredAction: true,
      timestamp: new Date(),
    });
  }

  // Workflow/timeline inconsistencies
  if (drift.workflow.mismatchRisk > 0.4) {
    alerts.push({
      severity: "warning",
      category: "timeline",
      message: `Timeline/experience sequence unclear or inconsistent with resume.`,
      recommendation: "Walk through your experience chronologically. Link claimed responsibilities to specific outcomes.",
      requiredAction: true,
      timestamp: new Date(),
    });
  }

  return alerts;
}

/**
 * Suggest Terminology in Real-Time
 * Based on readiness assessment and competency heatmap
 */
export function suggestTerminologyBoosts(
  session: LiveInterviewSession,
  transcript: string,
  readiness: ReturnType<typeof assessOperationTypeReadiness>,
  heatmap: ReturnType<typeof generateCompetencyHeatmap>
): TerminologySuggestion[] {
  const suggestions: TerminologySuggestion[] = [];

  // Find strongest domain
  const strongestDomain = readiness.competencies?.reduce((a, b) =>
    (a.proficiencyScore || 0) > (b.proficiencyScore || 0) ? a : b
  );

  if (strongestDomain) {
    // Identify strong alternatives for weak phrasing
    const weakPhrases = ["I think", "maybe", "kind of", "somewhat", "pretty much"];
    const foundWeakPhrase = weakPhrases.find((p) => transcript.includes(p));

    if (foundWeakPhrase) {
      suggestions.push({
        context: `Instead of "${foundWeakPhrase}", use direct declarative statements.`,
        missingTerms: [],
        strongerAlternatives: [
          { weak: "I think I have", strong: "I have demonstrated" },
          { weak: "kind of like", strong: "specifically" },
          { weak: "pretty much", strong: "exactly" },
          { weak: "maybe", strong: "in this case" },
        ],
        domainFocus: strongestDomain.domain || "operations",
        confidence: 0.85,
      });
    }

    // Suggest domain-specific terminology
    const domainTerms = extractDomainTerminology(strongestDomain.domain || "operations");
    const missingTerms = domainTerms.filter((t) => !transcript.toLowerCase().includes(t.toLowerCase()));

    if (missingTerms.length > 0) {
      suggestions.push({
        context: `Strengthen ${strongestDomain.domain} discussion with domain-specific terminology.`,
        missingTerms: missingTerms.slice(0, 3),
        strongerAlternatives: [],
        domainFocus: strongestDomain.domain || "operations",
        confidence: 0.75,
      });
    }
  }

  return suggestions;
}

/**
 * Inject Workflow Memory
 * Remind candidate about claimed workflows during questioning
 */
export function injectWorkflowMemory(
  resume: ResumeArtifact,
  question: string,
  readiness: ReturnType<typeof assessOperationTypeReadiness>
): string[] {
  const memories: string[] = [];

  // Extract workflows from resume
  const resumeWorkflows = extractWorkflows(resume.summary || "");

  // Match workflows to question context
  const questionKeywords = question.toLowerCase().split(/\s+/);
  const relevantWorkflows = resumeWorkflows.filter((w) =>
    questionKeywords.some((kw) => w.toLowerCase().includes(kw))
  );

  if (relevantWorkflows.length > 0) {
    memories.push(`You claimed: ${relevantWorkflows[0]}`);
    memories.push(`Connect this to the current question by explaining: how, when, and what impact.`);
  }

  // Add readiness-based hints
  if (readiness.strengths && readiness.strengths.length > 0) {
    memories.push(`Your strength: ${readiness.strengths[0]}. Use this to frame your answer.`);
  }

  if (readiness.weaknesses && readiness.weaknesses.length > 0) {
    memories.push(
      `Watch your weak area: ${readiness.weaknesses[0]}. Be careful not to oversell here.`
    );
  }

  return memories;
}

/**
 * Stabilize Confidence Alignment
 * Coaching prompts to maintain composure and consistency
 */
export function stabilizeConfidenceAlignment(
  transcript: string,
  alignmentScore: number,
  suspicionRisk: number
): { coachingPrompts: string[]; confidenceModifier: number } {
  const coachingPrompts: string[] = [];
  let confidenceModifier = 1.0;

  // If alignment dropping, provide reassurance
  if (alignmentScore < 0.65) {
    coachingPrompts.push("You're doing well. Take your time answering.");
    confidenceModifier = 0.9;
  }

  if (alignmentScore < 0.5) {
    coachingPrompts.push(
      "Clarify your experience with specific examples from your resume."
    );
    confidenceModifier = 0.75;
  }

  // If suspicion risk high, suggest calibration
  if (suspicionRisk > 0.35) {
    coachingPrompts.push(
      "Focus on honest, defensible claims. Avoid overstatement."
    );
    confidenceModifier = 0.8;
  }

  // Hesitation detection
  const hesitationCount = (transcript.match(/\b(um|uh|ugh|like|you know|basically)\b/gi) || []).length;
  if (hesitationCount > 5) {
    coachingPrompts.push("Reduce filler words. Pause confidently if you need to think.");
    confidenceModifier *= 0.85;
  }

  return { coachingPrompts, confidenceModifier };
}

/**
 * Reduce Recruiter Suspicion
 * Real-time tone calibration suggestions
 */
export function calibrateForRecruiterTrust(
  suspicionRisk: number,
  transcript: string
): { toneAdjustments: string[]; urgency: "low" | "medium" | "high" } {
  const adjustments: string[] = [];
  let urgency: "low" | "medium" | "high" = "low";

  if (suspicionRisk < 0.25) {
    adjustments.push("You're building good trust. Maintain your current approach.");
  }

  if (suspicionRisk >= 0.25 && suspicionRisk < 0.4) {
    urgency = "medium";
    adjustments.push("Be specific with examples. Avoid vague or inflated claims.");
    adjustments.push("Use concrete metrics and outcomes when possible.");
  }

  if (suspicionRisk >= 0.4) {
    urgency = "high";
    adjustments.push("CAUTION: Recruiter may be skeptical. Answer directly and honestly.");
    adjustments.push(
      "Avoid adding new information beyond your resume. Stick to verified experiences."
    );
  }

  // Detect overstatement patterns
  const superlatives = (
    transcript.match(/\b(best|greatest|best-in-class|world-class|expert|guru)\b/gi) || []
  ).length;
  if (superlatives > 2) {
    adjustments.push("Reduce superlatives. Use measured, professional language.");
    urgency = "high";
  }

  return { toneAdjustments: adjustments, urgency };
}

/**
 * Complete Live Assistance Context
 * Aggregates all real-time analysis for display/coaching
 */
export function buildLiveAssistanceContext(
  session: LiveInterviewSession,
  transcript: InterviewTranscriptSegment[],
  resume: ResumeArtifact,
  readiness: ReturnType<typeof assessOperationTypeReadiness>,
  heatmap: ReturnType<typeof generateCompetencyHeatmap>
): LiveAssistanceContext {
  const alerts = detectRealtimeDrift(session, transcript, resume);
  const suggestions = suggestTerminologyBoosts(
    session,
    transcript.map((s) => s.text).join(" "),
    readiness,
    heatmap
  );

  const interviewContext: InterviewContext = {
    userId: session.userId,
    resumeVariantUsed: resume.key,
    interviewTranscript: transcript.map((s) => s.text).join(" "),
    jobDescription: session.jobDescription,
    duration: Math.round((transcript[transcript.length - 1]?.timestamp.getTime() || 0 - session.interviewStartTime.getTime()) / 1000),
    stage: session.interviewStage,
    terminologyUsed: extractTerminology(transcript.filter((s) => s.speaker === "candidate").map((s) => s.text).join(" ")),
    confidenceIndicators: {
      hesitationPatterns: countHesitations(transcript.map((s) => s.text).join(" ")),
      clarificationRequests: countClarifications(transcript.map((s) => s.text).join(" ")),
      directAnswerRate: calculateDirectAnswerRate(transcript.map((s) => s.text).join(" ")),
    },
  };

  const drift = analyzeDrift(resume, interviewContext);
  const suspicion = assessRecruiterSuspicionRisk(resume);
  const alignmentTrend = alerts.filter((a) => a.severity === "critical").length === 0 ? 0.8 : 0.4;

  const confidence = stabilizeConfidenceAlignment(
    transcript.map((s) => s.text).join(" "),
    drift.alignmentScore,
    suspicion.overallRiskScore
  );

  return {
    driftAnalysis: drift,
    suspicionRisk: suspicion,
    readinessAssessment: readiness,
    competencyHeatmap: heatmap,
    alignmentTrend,
    alerts,
    suggestions,
    confidenceModifier: confidence.confidenceModifier,
  };
}

// Helper functions

function extractTerminology(text: string): string[] {
  // Extract domain-specific terms
  const terms = text.toLowerCase().match(/\b[a-z]+(?:[_-][a-z]+)?\b/g) || [];
  return Array.from(new Set(terms)).filter((t) => t.length > 4).slice(0, 20);
}

function countHesitations(text: string): number {
  return (text.match(/\b(um|uh|ugh|like|you know|basically)\b/gi) || []).length;
}

function countClarifications(text: string): number {
  return (text.match(/\b(wait|hold on|actually|let me clarify|what i meant)\b/gi) || []).length;
}

function calculateDirectAnswerRate(text: string): number {
  const totalWords = text.split(/\s+/).length;
  const fillerWords = countHesitations(text) + countClarifications(text);
  return Math.max(0, 1 - fillerWords / Math.max(1, totalWords / 10));
}

function extractWorkflows(text: string): string[] {
  // Simple workflow extraction from resume
  const workflows: string[] = [];
  const patterns = [/workflow[s]?.*?[\.\n]/gi, /process[es]?.*?[\.\n]/gi, /automation.*?[\.\n]/gi];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      workflows.push(...matches.map((m) => m.trim()));
    }
  }
  return workflows.slice(0, 5);
}

function extractDomainTerminology(domain: string): string[] {
  const domainTerms: Record<string, string[]> = {
    operations: [
      "workflow",
      "automation",
      "process optimization",
      "stakeholder management",
      "reporting",
      "KPI",
      "efficiency",
    ],
    finance: [
      "budgeting",
      "reconciliation",
      "cash flow",
      "financial analysis",
      "forecasting",
      "compliance",
      "audit",
    ],
    sales: ["pipeline", "closure", "qualification", "negotiation", "prospecting", "quota", "retention"],
    campaign: [
      "segmentation",
      "targeting",
      "conversion",
      "engagement",
      "analytics",
      "outreach",
      "ROI",
    ],
    admin: [
      "coordination",
      "scheduling",
      "documentation",
      "filing",
      "communication",
      "reliability",
      "follow-through",
    ],
    negotiation: ["leverage", "value", "mutual benefit", "terms", "risk management", "closing"],
    closing: ["objection handling", "urgency", "value prop", "decision maker", "next steps"],
  };

  return domainTerms[domain] || [];
}
