export function generateProposal(tender: { title?: string | null }) {
  return `
PROPOSAL

We provide structured administrative and operational support, ensuring accuracy, consistency, and compliance.

Our approach includes:
- Organized workflow management
- Accurate data handling
- Reliable reporting and follow-ups

We focus on delivering efficient, scalable support aligned with your requirements for ${String(tender.title || "this opportunity")}.

We are ready to begin immediately and adapt to project needs.
`;
}