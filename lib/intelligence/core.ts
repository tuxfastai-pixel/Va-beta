export type IntelligenceDomain =
  | "career"
  | "cv"
  | "skills"
  | "opportunity"
  | "application"
  | "learning"
  | "interview"
  | "governance"
  | "operations"

export type EvidenceStatus =
  | "confirmed"
  | "requires_confirmation"
  | "inferred"
  | "rejected"

export type EvidenceNode = {
  id: string
  section: string
  text: string
  sourceEvidence: string
  status: EvidenceStatus
  relationships?: string[]
}

export type IntelligenceQualityDimension =
  | "evidenceFidelity"
  | "contextDepth"
  | "materialImprovement"
  | "specificity"
  | "completeness"
  | "consistency"
  | "careerRelevance"
  | "uncertaintyHonesty"
  | "userControl"
  | "traceability"

export type IntelligenceQualityScores = Record<
  IntelligenceQualityDimension,
  number
>

export type IntelligenceDecision =
  | "accept"
  | "needs_confirmation"
  | "reject"

export type IntelligenceEvaluation = {
  decision: IntelligenceDecision
  score: number
  scores: IntelligenceQualityScores
  reasons: string[]
  warnings: string[]
  retainedEvidenceTerms: string[]
  missingEvidenceTerms: string[]
}

export const INTELLIGENCE_QUALITY_THRESHOLD = 78
export const INTELLIGENCE_VERSION = "va-intelligence-core-v1"

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by",
  "for", "from", "had", "has", "have", "in", "into", "is",
  "it", "of", "on", "or", "that", "the", "their", "this",
  "to", "was", "were", "while", "with",
])

const RESULT_CLAIMS = [
  "accelerated",
  "achieved",
  "boosted",
  "delivered",
  "drove",
  "enhanced",
  "ensured",
  "exceeded",
  "generated",
  "grew",
  "improved",
  "increased",
  "maximized",
  "optimized",
  "reduced",
  "saved",
  "transformed",
] as const

const GENERIC_PHRASES = [
  "responsible for",
  "various duties",
  "worked on",
  "helped with",
  "results driven",
  "hard working",
  "team player",
  "detail oriented",
  "excellent communication",
] as const

const SYNONYM_GROUPS = [
  ["maintained", "kept", "sustained"],
  ["current", "updated", "up to date"],
  ["supported", "assisted", "helped"],
  ["serviced", "maintained"],
  ["customer", "client"],
  ["used", "utilized"],
] as const

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function significantTerms(value: string): string[] {
  return unique(tokens(value)).filter((token) => token.length >= 4)
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 1
  return Math.max(0, Math.min(1, numerator / denominator))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function weightedScore(scores: IntelligenceQualityScores): number {
  return clampScore(
    scores.evidenceFidelity * 0.2 +
      scores.contextDepth * 0.08 +
      scores.materialImprovement * 0.18 +
      scores.specificity * 0.1 +
      scores.completeness * 0.12 +
      scores.consistency * 0.08 +
      scores.careerRelevance * 0.06 +
      scores.uncertaintyHonesty * 0.08 +
      scores.userControl * 0.04 +
      scores.traceability * 0.06
  )
}

function jaccardSimilarity(left: string[], right: string[]): number {
  const a = new Set(left)
  const b = new Set(right)
  const union = new Set([...a, ...b])
  if (union.size === 0) return 1
  let intersection = 0
  for (const value of a) {
    if (b.has(value)) intersection += 1
  }
  return intersection / union.size
}

function synonymOnlyRewrite(original: string, proposed: string): boolean {
  let left = normalize(original)
  let right = normalize(proposed)

  for (const group of SYNONYM_GROUPS) {
    const canonical = group[0]
    for (const phrase of group) {
      const pattern = new RegExp(
        `\\b${phrase.replace(/\s+/g, "\\s+")}\\b`,
        "g"
      )
      left = left.replace(pattern, canonical)
      right = right.replace(pattern, canonical)
    }
  }

  return left === right
}

function introducedResultClaims(
  proposed: string,
  evidence: string
): string[] {
  const source = normalize(evidence)
  const output = normalize(proposed)
  return RESULT_CLAIMS.filter(
    (claim) => output.includes(claim) && !source.includes(claim)
  )
}

function genericPhraseCount(value: string): number {
  const text = normalize(value)
  return GENERIC_PHRASES.filter((phrase) => text.includes(phrase)).length
}

export function buildEvidenceGraph(
  entries: Array<{
    id: string
    section: string
    text: string
    sourceEvidence?: string
    requiresConfirmation?: boolean
  }>
): EvidenceNode[] {
  return entries
    .filter((entry) => entry.id && entry.section && entry.text.trim())
    .map((entry) => ({
      id: entry.id,
      section: entry.section,
      text: entry.text.trim(),
      sourceEvidence:
        entry.sourceEvidence?.trim() || entry.text.trim(),
      status: entry.requiresConfirmation
        ? "requires_confirmation"
        : "confirmed",
      relationships: [],
    }))
}

export function evaluateIntelligenceCandidate(input: {
  domain: IntelligenceDomain
  originalText: string
  proposedText: string
  sourceEvidence: string
  reason: string
  preferredRoles?: string[]
  requiresConfirmation?: boolean
}): IntelligenceEvaluation {
  const evidence = [input.originalText, input.sourceEvidence]
    .filter(Boolean)
    .join("\n")
  const evidenceTerms = significantTerms(evidence)
  const proposedTerms = significantTerms(input.proposedText)
  const retainedEvidenceTerms = evidenceTerms.filter((term) =>
    proposedTerms.includes(term)
  )
  const missingEvidenceTerms = evidenceTerms.filter(
    (term) => !proposedTerms.includes(term)
  )
  const introducedTerms = proposedTerms.filter(
    (term) => !evidenceTerms.includes(term)
  )
  const resultClaims = introducedResultClaims(input.proposedText, evidence)
  const similarity = jaccardSimilarity(
    significantTerms(input.originalText),
    proposedTerms
  )
  const synonymOnly = synonymOnlyRewrite(
    input.originalText,
    input.proposedText
  )
  const reasons: string[] = []
  const warnings: string[] = []

  const evidenceRetention = ratio(
    retainedEvidenceTerms.length,
    evidenceTerms.length
  )
  const introductionRatio = ratio(
    introducedTerms.length,
    Math.max(1, proposedTerms.length)
  )
  const materialDelta = 1 - similarity
  const preferredRoleText = normalize(
    (input.preferredRoles || []).join(" ")
  )
  const roleTerms = significantTerms(preferredRoleText)
  const roleHits = roleTerms.filter((term) =>
    proposedTerms.includes(term)
  ).length

  const evidenceFidelity = clampScore(
    evidenceRetention * 100 -
      resultClaims.length * 35 -
      Math.max(0, introductionRatio - 0.45) * 50
  )
  const materialImprovement = clampScore(
    synonymOnly
      ? 5
      : materialDelta < 0.08
        ? 20
        : materialDelta > 0.72
          ? 55
          : 65 + materialDelta * 30
  )
  const completeness = clampScore(
    evidenceRetention * 100 -
      Math.max(0, missingEvidenceTerms.length - 2) * 4
  )
  const specificity = clampScore(
    72 +
      Math.min(18, retainedEvidenceTerms.length * 2) -
      genericPhraseCount(input.proposedText) * 18
  )
  const contextDepth = clampScore(
    55 +
      Math.min(25, evidenceTerms.length * 2) +
      (input.preferredRoles?.length ? 10 : 0)
  )
  const consistency = clampScore(
    94 - resultClaims.length * 30
  )
  const careerRelevance = clampScore(
    roleTerms.length === 0
      ? 72
      : 58 + ratio(roleHits, roleTerms.length) * 42
  )
  const uncertaintyHonesty = clampScore(
    input.requiresConfirmation
      ? 95
      : resultClaims.length > 0
        ? 35
        : 88
  )
  const userControl = 100
  const traceability = clampScore(
    input.reason.trim().length >= 24 ? 92 : 55
  )

  if (synonymOnly || materialImprovement < 45) {
    reasons.push(
      "The proposal is a shallow synonym or cosmetic rewrite rather than a material improvement."
    )
  }
  if (evidenceRetention < 0.72) {
    reasons.push(
      "The proposal removes too much meaningful evidence from the original entry."
    )
  }
  if (resultClaims.length > 0 && !input.requiresConfirmation) {
    reasons.push(
      `The proposal introduces unverified result language: ${resultClaims.join(", ")}.`
    )
  }
  if (genericPhraseCount(input.proposedText) > 0) {
    warnings.push(
      "The proposal contains generic CV language that does not add evidence."
    )
  }
  if (introductionRatio > 0.55 && !input.requiresConfirmation) {
    reasons.push(
      "The proposal introduces substantial new language without confirmation."
    )
  }

  const scores: IntelligenceQualityScores = {
    evidenceFidelity,
    contextDepth,
    materialImprovement,
    specificity,
    completeness,
    consistency,
    careerRelevance,
    uncertaintyHonesty,
    userControl,
    traceability,
  }
  const score = weightedScore(scores)
  const hardFailure =
    evidenceFidelity < 70 ||
    completeness < 65 ||
    materialImprovement < 45 ||
    (resultClaims.length > 0 && !input.requiresConfirmation)

  let decision: IntelligenceDecision
  if (hardFailure || score < INTELLIGENCE_QUALITY_THRESHOLD) {
    decision = "reject"
  } else if (input.requiresConfirmation) {
    decision = "needs_confirmation"
  } else {
    decision = "accept"
  }

  if (decision === "accept" && reasons.length === 0) {
    reasons.push(
      "The proposal materially improves the entry while preserving its evidence."
    )
  }

  return {
    decision,
    score,
    scores,
    reasons,
    warnings,
    retainedEvidenceTerms,
    missingEvidenceTerms,
  }
}

export function intelligenceSystemContract(
  domain: IntelligenceDomain
): string {
  return [
    `You are the ${domain} specialist connected to the VA Intelligence Core.`,
    `Intelligence version: ${INTELLIGENCE_VERSION}.`,
    "Think across the complete supplied context before producing an answer.",
    "Preserve every material fact that strengthens the user's verified evidence.",
    "Never convert an intended purpose, responsibility or expectation into a claimed result.",
    "Never replace evidence with generic professional language.",
    "A synonym swap, grammar-only edit or shorter sentence is not a material improvement.",
    "When stronger wording depends on an unverified duty, tool, result or achievement, explicitly require confirmation.",
    "Explain the specific professional value of every proposed change.",
    "Prefer grouped, coherent records over disconnected sentence fragments.",
    "Before returning output, internally act as analyst, generator, critic and verifier.",
    `Only return candidates capable of meeting a quality score of ${INTELLIGENCE_QUALITY_THRESHOLD} or higher.`,
  ].join("\n")
}
