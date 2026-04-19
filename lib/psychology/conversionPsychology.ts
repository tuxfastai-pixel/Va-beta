type SmartQuestionOptions = {
  optionA?: string;
  optionB?: string;
};

export function applyPsychology(proposal: string) {
  return `${String(proposal || "").trim()}

You’ll get:
+ Clear communication
+ Fast turnaround
+ Reliable delivery

I keep things simple and efficient so you don’t have to worry.`;
}

export function trustReply() {
  return `Got it - that makes sense.

I’ve handled similar tasks before and can keep this straightforward for you.

Let’s make sure we align on exactly what you need so I can deliver it properly.`;
}

export function askSmartQuestion(options: SmartQuestionOptions = {}) {
  const optionA = String(options.optionA || "Option A");
  const optionB = String(options.optionB || "Option B");

  return `Quick question - do you want this done as ${optionA} or ${optionB}?`;
}

export function closeDeal() {
  return `Everything looks clear from my side.

I can start immediately and have this done quickly.

Shall I go ahead and begin?`;
}

export function handlePriceObjection() {
  return `I understand - I focus on delivering value rather than just cost.

If it helps, I can adjust the scope to fit your budget while still getting the key results.`;
}

export function handleTrustObjection() {
  return `That’s fair.

I keep communication clear and make sure you’re updated throughout, so nothing is left uncertain.`;
}

export function addUrgencyPersonalization(title: string, body: string) {
  if (!String(title || "").toLowerCase().includes("urgent")) {
    return body;
  }

  return `${body}\n\nI can prioritize this immediately.`;
}
