export type CvChangeEvidence = Record<string, unknown>

function numericClaims(text: string): string[] {
  return text.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []
}

export function containsUnsupportedNumbers(
  proposedText: string,
  evidence: string
): boolean {
  const allowed = new Set(numericClaims(evidence))

  return numericClaims(proposedText).some(
    (value) => !allowed.has(value)
  )
}

export function evidenceForRejectedAlternative(
  row: CvChangeEvidence
): string {
  const confirmationStatus = String(
    row.confirmation_status || ""
  )
  const confirmedEvidence = String(
    row.confirmed_evidence || ""
  ).trim()

  if (
    confirmationStatus === "confirmed" &&
    confirmedEvidence
  ) {
    return confirmedEvidence
  }

  return (
    String(row.source_evidence || "").trim() ||
    String(row.original_text || "").trim()
  )
}
