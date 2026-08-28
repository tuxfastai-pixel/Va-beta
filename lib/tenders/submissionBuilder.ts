export function buildSubmission(
  tender: { id?: string | number },
  proposal: string,
  compliance: { documents: string[] }
) {
  return {
    tenderId: tender.id,
    proposal,
    documents: compliance.documents,
    ready: true,
  };
}