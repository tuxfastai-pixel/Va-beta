import { test } from "node:test"
import assert from "node:assert"
import {
  buildEvidenceGraph,
  evaluateIntelligenceCandidate,
  INTELLIGENCE_QUALITY_THRESHOLD,
} from "../../lib/intelligence/core.ts"

test("central intelligence graph preserves evidence status and source", () => {
  const graph = buildEvidenceGraph([
    {
      id: "evidence-1",
      section: "work_experience",
      text: "Position: Teller",
      sourceEvidence: "Responsibilities: Cashier",
      requiresConfirmation: true,
    },
  ])

  assert.equal(graph.length, 1)
  assert.equal(graph[0].status, "requires_confirmation")
  assert.equal(graph[0].sourceEvidence, "Responsibilities: Cashier")
})

test("central intelligence rejects shallow synonym rewrites", () => {
  const result = evaluateIntelligenceCandidate({
    domain: "cv",
    originalText:
      "Maintained current knowledge of product developments, service bulletins and technology updates.",
    proposedText:
      "Kept current with product developments, service bulletins and technology updates.",
    sourceEvidence:
      "Maintained current knowledge of product developments, service bulletins and technology updates.",
    reason: "Streamlined wording for clarity.",
  })

  assert.equal(result.decision, "reject")
  assert.ok(result.scores.materialImprovement < 45)
})

test("central intelligence blocks unsupported outcome inflation", () => {
  const result = evaluateIntelligenceCandidate({
    domain: "cv",
    originalText:
      "Serviced and maintained customer equipment to support equipment availability and customer satisfaction.",
    proposedText:
      "Serviced and maintained customer equipment, enhancing equipment availability and customer satisfaction.",
    sourceEvidence:
      "Serviced and maintained customer equipment to support equipment availability and customer satisfaction.",
    reason:
      "Improved clarity and action orientation in the description.",
  })

  assert.equal(result.decision, "reject")
  assert.match(result.reasons.join(" "), /unverified result language/i)
})

test("central intelligence blocks grammatical variants of unsupported outcomes", () => {
  const result = evaluateIntelligenceCandidate({
    domain: "cv",
    originalText: "Prepared weekly customer reports.",
    proposedText: "Prepared weekly customer reports, improving service delivery.",
    sourceEvidence: "Prepared weekly customer reports.",
    reason: "Made the business outcome more prominent for hiring managers.",
  })

  assert.equal(result.decision, "reject")
  assert.match(result.reasons.join(" "), /unverified result language: improved/i)
})

test("central intelligence blocks rewrites that discard transferable evidence", () => {
  const result = evaluateIntelligenceCandidate({
    domain: "cv",
    originalText:
      "Processed customer transactions, supported customers at the till and handled routine cash-related responsibilities.",
    proposedText:
      "Processed customer transactions and handled routine cash-related responsibilities at the till.",
    sourceEvidence:
      "Processed customer transactions, supported customers at the till and handled routine cash-related responsibilities.",
    reason: "Improved conciseness.",
  })

  assert.equal(result.decision, "reject")
  assert.ok(result.score < INTELLIGENCE_QUALITY_THRESHOLD)
})

test("central intelligence accepts material evidence-faithful improvement", () => {
  const result = evaluateIntelligenceCandidate({
    domain: "cv",
    originalText:
      "Responsibilities: To service and maintain customer equipment and to ensure a high level of equipment availability and customer satisfaction. To maintain updated knowledge of product developments, bulletins and technology updates.",
    proposedText:
      "Serviced and maintained customer equipment to support equipment availability and customer satisfaction. Maintained current knowledge of product developments, service bulletins and technology updates.",
    sourceEvidence:
      "Responsibilities: To service and maintain customer equipment and to ensure a high level of equipment availability and customer satisfaction. To maintain updated knowledge of product developments, bulletins and technology updates.",
    reason:
      "Converted passive responsibility wording into concise action-led CV language while preserving equipment maintenance, customer support and product-knowledge evidence.",
  })

  assert.equal(result.decision, "accept")
  assert.ok(result.score >= INTELLIGENCE_QUALITY_THRESHOLD)
})
