/**
 * Interview Readiness Confidence System
 * Per-operation-type readiness scores and competency tracking
 * Part of Phase 9B governance systems
 */

export type OperationType =
  | "campaign_operations"
  | "finance_operations"
  | "sales_operations"
  | "admin_operations"
  | "general_operations"
  | "negotiation"
  | "closing";

export interface TerminologyCompetency {
  domain: string;
  keywords: string[];
  confidenceScore: number; // 0-100
  strengthLevel: "expert" | "proficient" | "intermediate" | "novice" | "weak";
  nicheFamiliarity: number; // How specialized the knowledge is
}

export interface OperationTypeReadiness {
  operationType: OperationType;
  overallReadinessScore: number; // 0-100
  competencies: TerminologyCompetency[];
  strengths: string[];
  weaknesses: string[];
  preparationNeeded: boolean;
  recommendedActions: string[];
  lastAssessedAt: Date;
  assessmentCount: number;
}

export interface ReadinessProfile {
  userId: string;
  operationTypes: Record<OperationType, OperationTypeReadiness>;
  topStrengths: { domain: string; score: number }[];
  topWeaknesses: { domain: string; score: number }[];
  overallReadiness: number; // Weighted average
  lastUpdated: Date;
}

/**
 * Define operation-type specific competency domains
 */
const OPERATION_TYPE_DOMAINS: Record<OperationType, string[]> = {
  campaign_operations: [
    "campaign_strategy",
    "audience_segmentation",
    "marketing_channels",
    "performance_metrics",
    "lead_nurturing",
    "conversion_optimization",
    "budget_management",
    "analytics",
  ],
  finance_operations: [
    "accounting",
    "bookkeeping",
    "tax_compliance",
    "vat_reporting",
    "reconciliation",
    "financial_planning",
    "audit_readiness",
    "cash_flow_management",
  ],
  sales_operations: [
    "sales_methodology",
    "client_qualification",
    "negotiation",
    "closing_techniques",
    "crm_systems",
    "pipeline_management",
    "forecasting",
    "customer_retention",
  ],
  admin_operations: [
    "workflow_management",
    "documentation",
    "compliance",
    "scheduling",
    "data_management",
    "process_improvement",
    "communication",
    "organization",
  ],
  general_operations: [
    "communication",
    "problem_solving",
    "time_management",
    "collaboration",
    "learning_agility",
    "adaptability",
  ],
  negotiation: [
    "value_proposition",
    "pricing_strategy",
    "objection_handling",
    "win_win_solutions",
    "contract_terms",
    "stakeholder_management",
    "de_escalation",
  ],
  closing: [
    "relationship_building",
    "objection_resolution",
    "deal_structure",
    "risk_mitigation",
    "follow_through",
    "documentation",
    "expectation_setting",
  ],
};

/**
 * Assess competency in a specific domain based on keywords
 */
function assessDomainCompetency(
  domain: string,
  interviewTranscript: string
): TerminologyCompetency {
  const domainKeywordMap: Record<string, string[]> = {
    campaign_strategy: [
      "strategy",
      "target",
      "segment",
      "positioning",
      "messaging",
      "goals",
      "objectives",
    ],
    audience_segmentation: [
      "segment",
      "persona",
      "demographic",
      "behavioral",
      "clustering",
      "targeting",
    ],
    marketing_channels: [
      "email",
      "social",
      "content",
      "paid",
      "organic",
      "media",
      "channel",
    ],
    accounting: [
      "debit",
      "credit",
      "ledger",
      "accounts",
      "transaction",
      "journal",
      "accounting",
    ],
    vat_reporting: ["vat", "tax", "reporting", "compliance", "return", "filing"],
    negotiation: ["negotiate", "terms", "pricing", "rate", "agreement", "contract"],
    closing_techniques: [
      "close",
      "seal",
      "finalize",
      "commit",
      "decide",
      "confirm",
      "signature",
    ],
  };

  const keywords = domainKeywordMap[domain] || [];
  const transcript = interviewTranscript.toLowerCase();

  let keywordMatches = 0;
  let confidenceIndicators = 0;
  let hesitationIndicators = 0;

  for (const keyword of keywords) {
    if (transcript.includes(keyword)) {
      keywordMatches++;
      // Check for confident phrasing
      if (
        transcript.match(
          new RegExp(`\\b${keyword}\\b.*\\b(always|usually|definitely|absolutely|certainly)\\b`)
        )
      ) {
        confidenceIndicators++;
      }
      // Check for hesitant phrasing
      if (
        transcript.match(
          new RegExp(`\\b(?:uh|um|maybe|i think|not sure).*${keyword}\\b`)
        )
      ) {
        hesitationIndicators++;
      }
    }
  }

  // Calculate confidence score
  const keywordCoverage = (keywordMatches / Math.max(keywords.length, 1)) * 100;
  const confidenceModifier = (confidenceIndicators - hesitationIndicators) * 5;
  const baseScore = Math.min(100, keywordCoverage * 0.7 + confidenceModifier);
  const confidenceScore = Math.max(0, baseScore);

  // Determine strength level
  let strengthLevel: TerminologyCompetency["strengthLevel"];
  if (confidenceScore >= 85) strengthLevel = "expert";
  else if (confidenceScore >= 70) strengthLevel = "proficient";
  else if (confidenceScore >= 50) strengthLevel = "intermediate";
  else if (confidenceScore >= 30) strengthLevel = "novice";
  else strengthLevel = "weak";

  // Calculate niche familiarity (how specialized)
  const nicheFamiliarity = Math.min(100, (keywordMatches / keywords.length) * 30 + confidenceScore * 0.7);

  return {
    domain,
    keywords: keywords.filter(k =>
      transcript.includes(k)
    ),
    confidenceScore: Math.round(confidenceScore),
    strengthLevel,
    nicheFamiliarity: Math.round(nicheFamiliarity),
  };
}

/**
 * Assess readiness for a specific operation type
 */
export function assessOperationTypeReadiness(
  operationType: OperationType,
  interviewTranscript: string,
  previousReadiness?: OperationTypeReadiness
): OperationTypeReadiness {
  const domains = OPERATION_TYPE_DOMAINS[operationType] || [];

  // Assess each domain
  const competencies = domains.map(domain =>
    assessDomainCompetency(domain, interviewTranscript)
  );

  // Calculate overall readiness
  const avgScore =
    competencies.reduce((sum, c) => sum + c.confidenceScore, 0) /
    Math.max(competencies.length, 1);

  // Identify strengths and weaknesses
  const sortedCompetencies = [...competencies].sort(
    (a, b) => b.confidenceScore - a.confidenceScore
  );

  const strengths = sortedCompetencies
    .slice(0, 3)
    .filter(c => c.confidenceScore >= 60)
    .map(c => `${c.domain} (${c.confidenceScore}%)`);

  const weaknesses = sortedCompetencies
    .slice(-3)
    .filter(c => c.confidenceScore < 50)
    .map(c => `${c.domain} (${c.confidenceScore}%)`);

  // Determine if preparation is needed
  const preparationNeeded = avgScore < 70 || weaknesses.length > 2;

  // Generate recommendations
  const recommendedActions: string[] = [];

  if (avgScore < 50) {
    recommendedActions.push(
      `ðŸ”´ CRITICAL: Readiness score below 50%. Intensive preparation required before interviews.`
    );
  } else if (avgScore < 70) {
    recommendedActions.push(
      `ðŸŸ¡ MODERATE: Readiness score ${Math.round(avgScore)}%. Targeted preparation recommended.`
    );
  } else if (avgScore >= 85) {
    recommendedActions.push(`âœ… HIGH: Well-prepared for ${operationType} interviews.`);
  }

  for (const weakness of weaknesses) {
    const domain = weakness.split(" ")[0];
    recommendedActions.push(
      `ðŸ“š Build competency in: ${domain}`
    );
  }

  if (strengths.length > 0) {
    recommendedActions.push(
      `â­ Leverage strengths: ${strengths.map(s => s.split(" ")[0]).join(", ")}`
    );
  }

  // Smooth readiness score if we have previous assessment
  let overallReadinessScore = avgScore;
  if (previousReadiness) {
    // Smooth with previous score to prevent drastic changes
    overallReadinessScore =
      previousReadiness.overallReadinessScore * 0.6 + avgScore * 0.4;
  }

  return {
    operationType,
    overallReadinessScore: Math.round(overallReadinessScore),
    competencies,
    strengths: strengths.map(s => s.split(" ")[0]),
    weaknesses: weaknesses.map(w => w.split(" ")[0]),
    preparationNeeded,
    recommendedActions,
    lastAssessedAt: new Date(),
    assessmentCount: (previousReadiness?.assessmentCount || 0) + 1,
  };
}

/**
 * Build comprehensive readiness profile
 */
export function buildReadinessProfile(
  userId: string,
  interviewTranscripts: Record<OperationType, string[]>,
  previousProfile?: ReadinessProfile
): ReadinessProfile {
  const operationTypes = {} as Record<OperationType, OperationTypeReadiness>;

  // Assess each operation type
  const allOperationTypes: OperationType[] = [
    "campaign_operations",
    "finance_operations",
    "sales_operations",
    "admin_operations",
    "general_operations",
    "negotiation",
    "closing",
  ];

  for (const opType of allOperationTypes) {
    const transcripts = interviewTranscripts[opType] || [];
    const combinedTranscript = transcripts.join(" ");

    operationTypes[opType] = assessOperationTypeReadiness(
      opType,
      combinedTranscript,
      previousProfile?.operationTypes[opType]
    );
  }

  // Aggregate strengths and weaknesses
  const allCompetencies: TerminologyCompetency[] = [];
  for (const readiness of Object.values(operationTypes)) {
    allCompetencies.push(...readiness.competencies);
  }

  const sortedCompetencies = [...allCompetencies].sort(
    (a, b) => b.confidenceScore - a.confidenceScore
  );

  const topStrengths = sortedCompetencies
    .slice(0, 5)
    .filter(c => c.confidenceScore >= 70)
    .map(c => ({ domain: c.domain, score: c.confidenceScore }));

  const topWeaknesses = sortedCompetencies
    .slice(-5)
    .filter(c => c.confidenceScore < 50)
    .map(c => ({ domain: c.domain, score: c.confidenceScore }));

  // Calculate overall readiness
  const scores = Object.values(operationTypes).map(r => r.overallReadinessScore);
  const overallReadiness =
    scores.length > 0
      ? scores.reduce((a, b) => a + b) / scores.length
      : 0;

  return {
    userId,
    operationTypes,
    topStrengths,
    topWeaknesses,
    overallReadiness: Math.round(overallReadiness),
    lastUpdated: new Date(),
  };
}

/**
 * Export readiness data for dashboard visualization
 */
export function exportReadinessData(profile: ReadinessProfile) {
  return {
    userId: profile.userId,
    overallReadiness: profile.overallReadiness,
    operationTypes: Object.entries(profile.operationTypes).map(
      ([key, readiness]) => ({
        operationType: key,
        readinessScore: readiness.overallReadinessScore,
        preparationNeeded: readiness.preparationNeeded,
        topStrengths: readiness.strengths.slice(0, 3),
        topWeaknesses: readiness.weaknesses.slice(0, 3),
        assessmentCount: readiness.assessmentCount,
      })
    ),
    topStrengths: profile.topStrengths,
    topWeaknesses: profile.topWeaknesses,
    lastUpdated: profile.lastUpdated.toISOString(),
  };
}
