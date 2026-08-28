export type InterviewRiskLevel = "low" | "medium" | "high" | "critical";

export interface InterviewDriftInput {
  transcript?: string;
  alignmentScore: number;
  terminology: string[];
  workflowHints: string[];
  confidenceLevel?: number;
  meetingStage?: string;
  intent?: string;
  primaryIdentity?: string;
}

export interface InterviewDriftAssessment {
  riskLevel: InterviewRiskLevel;
  riskScore: number;
  recruiterSuspicionRisk: number;
  flags: string[];
  summary: string;
  recommendation: string;
  readinessByDomain: Record<string, number>;
  termCompetency: Array<{ term: string; confidence: number }>;
  diagnostics: {
    terminologyOverlap: number;
    workflowOverlap: number;
    confidenceGap: number;
    hesitationScore: number;
    realismInconsistency: number;
  };
}

export const INTERVIEW_ALIGNMENT_THRESHOLDS = {
  highRisk: 60,
  mediumRisk: 75,
  minTerminologyOverlap: 0.24,
  minWorkflowOverlap: 0.22,
  maxConfidenceGap: 24,
  maxHesitationScore: 30,
} as const;

const HESITATION_PATTERNS: RegExp[] = [
  /\bum\b/gi,
  /\buh\b/gi,
  /\bi think\b/gi,
  /\bnot sure\b/gi,
  /\bkind of\b/gi,
  /\bmaybe\b/gi,
  /\bsort of\b/gi,
];

function tokenize(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function overlapRatio(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size || !rightSet.size) return 0;

  let matches = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) matches += 1;
  }

  return matches / Math.max(leftSet.size, rightSet.size);
}

function countMatches(patterns: RegExp[], value: string): number {
  return patterns.reduce((total, pattern) => {
    const matches = value.match(pattern);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function toPercent(value: number): number {
  return Number((Math.max(0, Math.min(1, value)) * 100).toFixed(1));
}

function toRiskLevel(score: number): InterviewRiskLevel {
  if (score >= 80) return "critical";
  if (score >= INTERVIEW_ALIGNMENT_THRESHOLDS.highRisk) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function deriveReadinessByDomain(input: InterviewDriftInput, terminologyOverlap: number, workflowOverlap: number): Record<string, number> {
  const termBlob = `${input.primaryIdentity || ""} ${input.terminology.join(" ")}`.toLowerCase();
  const base = Math.max(40, Math.min(95, input.alignmentScore));
  const overlapBoost = (terminologyOverlap * 8) + (workflowOverlap * 8);

  const campaignWeight = /campaign|crm|pipeline|lead|salesforce/.test(termBlob) ? 6 : -2;
  const financeWeight = /finance|audit|invoice|reconciliation|compliance/.test(termBlob) ? 6 : -2;
  const opsWeight = /operations|workflow|handoff|sla|delivery/.test(termBlob) ? 6 : 0;

  return {
    campaign_operations: Number(Math.max(25, Math.min(98, base + overlapBoost + campaignWeight)).toFixed(1)),
    finance_operations: Number(Math.max(25, Math.min(98, base + overlapBoost + financeWeight)).toFixed(1)),
    operations_execution: Number(Math.max(25, Math.min(98, base + overlapBoost + opsWeight)).toFixed(1)),
  };
}

export function assessInterviewDrift(input: InterviewDriftInput): InterviewDriftAssessment {
  const transcript = String(input.transcript || "").trim();
  const transcriptTokens = tokenize(transcript);
  const terminologyTokens = tokenize(input.terminology.join(" "));
  const workflowTokens = tokenize(input.workflowHints.join(" "));

  const terminologyOverlap = overlapRatio(transcriptTokens, terminologyTokens);
  const workflowOverlap = overlapRatio(transcriptTokens, workflowTokens);

  const confidenceLevel = Number.isFinite(Number(input.confidenceLevel)) ? Number(input.confidenceLevel) : input.alignmentScore;
  const confidenceGap = Math.abs(confidenceLevel - input.alignmentScore);

  const hesitationMatches = countMatches(HESITATION_PATTERNS, transcript.toLowerCase());
  const hesitationScore = transcript.length > 0
    ? Math.min(100, Number(((hesitationMatches / Math.max(1, transcriptTokens.length)) * 260).toFixed(1)))
    : 0;

  const realismInconsistency = Math.max(
    0,
    Math.min(
      100,
      Number((
        (input.alignmentScore >= 82 && terminologyOverlap < 0.16 ? 35 : 0) +
        (confidenceLevel >= 85 && hesitationScore >= 28 ? 25 : 0) +
        (workflowOverlap < 0.14 ? 18 : 0)
      ).toFixed(1)),
    ),
  );

  const flags: string[] = [];

  if (terminologyOverlap < INTERVIEW_ALIGNMENT_THRESHOLDS.minTerminologyOverlap) {
    flags.push("terminology_mismatch");
  }
  if (workflowOverlap < INTERVIEW_ALIGNMENT_THRESHOLDS.minWorkflowOverlap) {
    flags.push("workflow_mismatch");
  }
  if (confidenceGap > INTERVIEW_ALIGNMENT_THRESHOLDS.maxConfidenceGap) {
    flags.push("confidence_mismatch");
  }
  if (hesitationScore > INTERVIEW_ALIGNMENT_THRESHOLDS.maxHesitationScore) {
    flags.push("hesitation_pattern_detected");
  }
  if (realismInconsistency >= 28) {
    flags.push("realism_inconsistency");
  }
  if (input.alignmentScore < INTERVIEW_ALIGNMENT_THRESHOLDS.highRisk) {
    flags.push("alignment_threshold_breach");
  }

  const riskScore = Number(Math.max(0, Math.min(100,
    ((100 - input.alignmentScore) * 0.44) +
    ((1 - terminologyOverlap) * 100 * 0.2) +
    ((1 - workflowOverlap) * 100 * 0.14) +
    (confidenceGap * 0.1) +
    (hesitationScore * 0.07) +
    (realismInconsistency * 0.05),
  )).toFixed(1));

  const recruiterSuspicionRisk = Number(Math.max(0, Math.min(100,
    (riskScore * 0.7) +
    ((flags.includes("realism_inconsistency") ? 12 : 0)) +
    ((flags.includes("confidence_mismatch") ? 8 : 0)),
  )).toFixed(1));

  const riskLevel = toRiskLevel(riskScore);

  const summary = riskLevel === "low"
    ? "Interview alignment remains credible with low drift signals."
    : riskLevel === "medium"
      ? "Moderate drift detected; tune language and workflow clarity before high-stakes interviews."
      : riskLevel === "high"
        ? "High interview alignment risk detected; recruiter trust can drop without calibration."
        : "Critical interview mismatch risk; pause aggressive positioning until calibration completes.";

  const recommendation = flags.includes("terminology_mismatch")
    ? "Reduce resume complexity emphasis or strengthen interview terminology preparation before deployment."
    : flags.includes("workflow_mismatch")
      ? "Rehearse concrete execution sequences so interview answers mirror resume workflow claims."
      : flags.includes("confidence_mismatch")
        ? "Align coaching confidence targets with current capability depth and avoid inflated claims."
        : "Maintain current identity and continue readiness drills with live feedback.";

  const readinessByDomain = deriveReadinessByDomain(input, terminologyOverlap, workflowOverlap);

  const termCompetency = input.terminology.slice(0, 14).map((term) => {
    const termTokens = tokenize(term);
    const confidence = toPercent(overlapRatio(termTokens, transcriptTokens));
    return {
      term,
      confidence,
    };
  });

  return {
    riskLevel,
    riskScore,
    recruiterSuspicionRisk,
    flags,
    summary,
    recommendation,
    readinessByDomain,
    termCompetency,
    diagnostics: {
      terminologyOverlap: toPercent(terminologyOverlap),
      workflowOverlap: toPercent(workflowOverlap),
      confidenceGap: Number(confidenceGap.toFixed(1)),
      hesitationScore,
      realismInconsistency,
    },
  };
}
