export type FollowUpStage = 1 | 2 | 3;

export function generateFollowUpMessage(stage: FollowUpStage, paymentLink: string) {
  if (stage === 1) {
    return `Just checking in - here is your secure payment link again:

${paymentLink}

Let me know if you need anything clarified before we begin.`;
  }

  if (stage === 2) {
    return `Quick reminder - I have reserved your slot and can start immediately once payment is confirmed.

Here is the link:
${paymentLink}

Let me know if you would like me to proceed.`;
  }

  if (stage === 3) {
    return `Final check-in - I will need to release this slot shortly if I do not hear back.

You can still proceed here:
${paymentLink}

Happy to reopen if needed later.`;
  }

  return "";
}