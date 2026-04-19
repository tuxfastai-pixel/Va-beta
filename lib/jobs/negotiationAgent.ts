type NegotiationJob = {
  pay_amount?: number | null;
  title?: string | null;
};

export function generateNegotiationReply(job: NegotiationJob) {
  return `
Thanks for your response.

Based on the scope, I can deliver this efficiently with high quality.

Proposed rate: $${job.pay_amount ?? "TBD"}

I can start immediately and keep you updated throughout.

Let me know if that works for you.
`;
}
