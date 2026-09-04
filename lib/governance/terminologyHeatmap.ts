/**
 * Terminology Competency Heatmap
 * Visualizes strongest/weakest operational vocabularies and niche familiarity depth
 * Part of Phase 9B governance systems
 */

export interface TerminologyCompetencyNode {
  term: string;
  domain: string;
  confidenceScore: number; // 0-100
  mentionCount: number;
  contextQuality: "strong" | "moderate" | "weak";
  nicheFamiliarity: number; // 0-100, how specialized
  associatedTerms: string[];
  learningTrend: "improving" | "stable" | "declining";
}

export interface CompetencyHeatmapData {
  userId: string;
  generatedAt: Date;
  dominantDomains: Array<{ domain: string; strength: number }>;
  nicheFamiliarity: Array<{ domain: string; depth: number }>;
  competencyNetwork: TerminologyCompetencyNode[];
  gaps: Array<{ domain: string; missingTerms: string[]; importance: "high" | "medium" | "low" }>;
  recommendations: string[];
}

/**
 * Extract terminology and analyze context
 */
function extractTerminologyContext(
  transcript: string,
  domain: string
): { terms: Map<string, number>; contextMap: Map<string, string[]> } {
  const terms = new Map<string, number>();
  const contextMap = new Map<string, string[]>();

  // Domain-specific terminology patterns
  const domainPatterns: Record<string, RegExp[]> = {
    financial: [
      /\b(debit|credit|reconcil|audit|vat|tax|ledger|journal|transaction|expense|revenue|cash|flow|balance|statement|report|compliance|invoice|receipt)\b/gi,
    ],
    technical: [
      /\b(api|database|server|client|frontend|backend|algorithm|data structure|optimization|integration|deployment|testing|ci\/cd|pipeline|automation)\b/gi,
    ],
    sales: [
      /\b(prospect|lead|qualify|pitch|close|negotiat|contract|terms|agreement|discount|pipeline|forecast|target|quota|commission|conversion)\b/gi,
    ],
    marketing: [
      /\b(campaign|segment|audience|targeting|conversion|funnel|engagement|reach|impression|click|ctr|roi|attribution|analytics|personalization)\b/gi,
    ],
    operations: [
      /\b(workflow|process|automation|efficiency|throughput|bottleneck|scheduling|resource|allocation|planning|capacity|management|control)\b/gi,
    ],
    leadership: [
      /\b(delegate|mentor|coach|direct|report|team|manage|lead|vision|strategy|decision|accountability|communication|development|growth)\b/gi,
    ],
  };

  // Get relevant patterns for this domain
  const patterns = domainPatterns[domain] || [];

  // Extract all matches and their context
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(transcript)) !== null) {
      const term = match[0].toLowerCase();
      terms.set(term, (terms.get(term) || 0) + 1);

      // Extract context (surrounding words)
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(
        transcript.length,
        match.index + match[0].length + 50
      );
      const context = transcript.substring(contextStart, contextEnd);

      if (!contextMap.has(term)) {
        contextMap.set(term, []);
      }
      contextMap.get(term)!.push(context);
    }
  }

  return { terms, contextMap };
}

/**
 * Determine context quality (whether terms are used correctly/confidently)
 */
function evaluateContextQuality(contexts: string[]): "strong" | "moderate" | "weak" {
  if (!contexts || contexts.length === 0) return "weak";

  const avgContextLength = contexts.reduce((sum, c) => sum + c.length, 0) / contexts.length;

  // Longer, more detailed contexts suggest deeper understanding
  if (avgContextLength > 100) {
    // Check for confident language
    const hasConfidence = contexts.some(c =>
      /\b(always|definitely|certainly|absolutely|expert|mastered|proficient)\b/i.test(c)
    );
    return hasConfidence ? "strong" : "moderate";
  } else if (avgContextLength > 50) {
    return "moderate";
  } else {
    return "weak";
  }
}

/**
 * Find associated terms (co-occurring terms in similar contexts)
 */
function findAssociatedTerms(
  mainTerm: string,
  contextMap: Map<string, string[]>,
  allTerms: string[]
): string[] {
  const contexts = contextMap.get(mainTerm) || [];
  const associatedTerms = new Set<string>();

  for (const context of contexts) {
    for (const term of allTerms) {
      if (
        term !== mainTerm &&
        context.toLowerCase().includes(term.toLowerCase())
      ) {
        associatedTerms.add(term);
      }
    }
  }

  return Array.from(associatedTerms).slice(0, 5);
}

/**
 * Analyze learning trend for a term
 */
function analyzeLearningTrend(
  mentionCount: number,
  contextQuality: string,
  allMentionCounts: number[]
): "improving" | "stable" | "declining" {
  const avgMentions =
    allMentionCounts.reduce((a, b) => a + b) / Math.max(allMentionCounts.length, 1);

  if (mentionCount > avgMentions * 1.5) {
    return "improving"; // Being mentioned more frequently
  } else if (contextQuality === "strong" && mentionCount >= avgMentions) {
    return "stable";
  } else {
    return "declining";
  }
}

/**
 * Identify terminology gaps in a domain
 */
function identifyGaps(
  domain: string,
  foundTerms: Set<string>,
  essentialTerms: string[]
): string[] {
  const missing = essentialTerms.filter(
    term => !foundTerms.has(term.toLowerCase())
  );

  // Prioritize gaps - return top gaps
  return missing.slice(0, 5);
}

/**
 * Generate competency heatmap
 */
export function generateCompetencyHeatmap(
  userId: string,
  interviewTranscripts: Record<string, string>,
  previousHeatmap?: CompetencyHeatmapData
): CompetencyHeatmapData {
  const competencyNetwork: TerminologyCompetencyNode[] = [];
  const dominantDomains: Map<string, number> = new Map();
  const nicheFamiliarityMap: Map<string, number> = new Map();
  const gaps: CompetencyHeatmapData["gaps"] = [];

  const allMentionCounts: number[] = [];

  // Essential terminology by domain
  const essentialTerms: Record<string, string[]> = {
    financial: [
      "debit",
      "credit",
      "reconcile",
      "audit",
      "vat",
      "tax",
      "ledger",
      "journal",
      "compliance",
      "balance",
      "transaction",
    ],
    technical: [
      "api",
      "database",
      "algorithm",
      "optimization",
      "deployment",
      "testing",
      "integration",
      "architecture",
      "performance",
      "security",
    ],
    sales: [
      "prospect",
      "lead",
      "qualify",
      "close",
      "negotiate",
      "contract",
      "pipeline",
      "forecast",
      "conversion",
      "commission",
    ],
    marketing: [
      "segment",
      "campaign",
      "targeting",
      "engagement",
      "conversion",
      "analytics",
      "attribution",
      "personalization",
      "roi",
      "funnel",
    ],
    operations: [
      "workflow",
      "process",
      "automation",
      "efficiency",
      "bottleneck",
      "capacity",
      "scheduling",
      "resource",
      "allocation",
      "control",
    ],
    leadership: [
      "delegate",
      "mentor",
      "coach",
      "vision",
      "strategy",
      "accountability",
      "team",
      "development",
      "communication",
      "decision",
    ],
  };

  // Analyze each domain
  for (const [domain, essentialList] of Object.entries(essentialTerms)) {
    const transcript = interviewTranscripts[domain] || "";

    if (!transcript) continue;

    const { terms: extractedTerms, contextMap } = extractTerminologyContext(
      transcript,
      domain
    );

    if (extractedTerms.size === 0) continue;

    let domainStrength = 0;
    let domainNicheFamiliarity = 0;

    // Process each extracted term
    for (const [term, mentionCount] of extractedTerms) {
      allMentionCounts.push(mentionCount);

      const contexts = contextMap.get(term) || [];
      const contextQuality = evaluateContextQuality(contexts);
      const associatedTerms = findAssociatedTerms(
        term,
        contextMap,
        Array.from(extractedTerms.keys())
      );
      const learningTrend = analyzeLearningTrend(
        mentionCount,
        contextQuality,
        allMentionCounts
      );

      // Calculate confidence score
      let confidenceScore = (mentionCount / 10) * 50 + 50; // Base 50-100

      if (contextQuality === "strong") {
        confidenceScore += 20;
      } else if (contextQuality === "moderate") {
        confidenceScore += 10;
      }

      // Calculate niche familiarity
      const nicheFamiliarity = Math.min(
        100,
        mentionCount * 10 + associatedTerms.length * 5
      );

      confidenceScore = Math.min(100, confidenceScore);

      competencyNetwork.push({
        term,
        domain,
        confidenceScore: Math.round(confidenceScore),
        mentionCount,
        contextQuality,
        nicheFamiliarity: Math.round(nicheFamiliarity),
        associatedTerms,
        learningTrend,
      });

      domainStrength += confidenceScore;
      domainNicheFamiliarity += nicheFamiliarity;
    }

    // Calculate domain metrics
    if (extractedTerms.size > 0) {
      const avgDomainStrength = domainStrength / extractedTerms.size;
      const avgNicheFamiliarity = domainNicheFamiliarity / extractedTerms.size;

      dominantDomains.set(domain, avgDomainStrength);
      nicheFamiliarityMap.set(domain, avgNicheFamiliarity);

      // Identify gaps
      const gapList = identifyGaps(
        domain,
        extractedTerms,
        essentialList
      );

      if (gapList.length > 0) {
        // Assess gap importance
        let importance: "high" | "medium" | "low" = "medium";
        if (avgDomainStrength < 50) {
          importance = "high";
        } else if (avgDomainStrength > 80) {
          importance = "low";
        }

        gaps.push({
          domain,
          missingTerms: gapList,
          importance,
        });
      }
    }
  }

  // Sort networks by confidence
  competencyNetwork.sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Generate recommendations
  const recommendations: string[] = [];

  // Top strengths
  const topStrengths = competencyNetwork
    .filter(n => n.confidenceScore >= 80)
    .slice(0, 3);

  if (topStrengths.length > 0) {
    recommendations.push(
      `â­ STRENGTHS: Excel in ${topStrengths.map(s => s.domain).join(", ")}`
    );
  }

  // Top gaps
  const highPriorityGaps = gaps.filter(g => g.importance === "high");
  if (highPriorityGaps.length > 0) {
    recommendations.push(
      `ðŸ”´ PRIORITY: Build competency in ${highPriorityGaps
        .map(g => g.domain)
        .join(", ")}`
    );
  }

  // Niche opportunities
  const nicheOpportunities = Array.from(nicheFamiliarityMap.entries())
    .filter(([, depth]) => depth > 70)
    .map(([domain]) => domain);

  if (nicheOpportunities.length > 0) {
    recommendations.push(
      `ðŸ’Ž SPECIALIZE: Deepen expertise in ${nicheOpportunities.join(", ")}`
    );
  }

  // Learning trends
  const improvingTerms = competencyNetwork.filter(
    n => n.learningTrend === "improving"
  );
  if (improvingTerms.length > 3) {
    recommendations.push(`ðŸ“ˆ MOMENTUM: Continue building on improving areas`);
  }

  return {
    userId,
    generatedAt: new Date(),
    dominantDomains: Array.from(dominantDomains.entries())
      .map(([domain, strength]) => ({ domain, strength: Math.round(strength) }))
      .sort((a, b) => b.strength - a.strength),
    nicheFamiliarity: Array.from(nicheFamiliarityMap.entries())
      .map(([domain, depth]) => ({ domain, depth: Math.round(depth) }))
      .sort((a, b) => b.depth - a.depth),
    competencyNetwork,
    gaps,
    recommendations,
  };
}

/**
 * Export heatmap data for visualization
 */
export function exportHeatmapData(heatmap: CompetencyHeatmapData) {
  return {
    userId: heatmap.userId,
    generatedAt: heatmap.generatedAt.toISOString(),
    dominantDomains: heatmap.dominantDomains,
    nicheFamiliarity: heatmap.nicheFamiliarity,
    topTerms: heatmap.competencyNetwork
      .slice(0, 20)
      .map(n => ({
        term: n.term,
        domain: n.domain,
        confidence: n.confidenceScore,
        mentions: n.mentionCount,
        quality: n.contextQuality,
        trend: n.learningTrend,
      })),
    gaps: heatmap.gaps,
    recommendations: heatmap.recommendations,
  };
}
