export interface ProfessionalCoachingInput {
  context: "interview" | "negotiation" | "client_call" | "tender" | "general";
  userConfidence?: number;
  identityFocus?: {
    label: string;
    terminology?: string[];
    workflowPriorities?: string[];
  };
}

export function runProfessionalCoaching(input: ProfessionalCoachingInput) {
  const confidence = Math.max(0, Math.min(1, Number(input.userConfidence || 0.55)));

  const toneGuidance = confidence < 0.45
    ? "Speak slightly slower, use short sentences, and pause before answering."
    : "Use concise statements with clear structure and specific examples.";

  const pacingGuidance = confidence < 0.45
    ? "Use the 3-step structure: clarify, confirm, commit."
    : "Use the 2-step structure: answer, evidence.";

  const objectionHandling = [
    "Acknowledge the concern directly.",
    "Reframe around measurable outcomes.",
    "Offer a low-risk next action.",
  ];

  const identityAlignment = input.identityFocus
    ? {
        identityLabel: input.identityFocus.label,
        terminology: (input.identityFocus.terminology || []).slice(0, 8),
        interviewWorkflow: (input.identityFocus.workflowPriorities || []).slice(0, 4),
      }
    : undefined;

  return {
    toneGuidance,
    confidenceSupport: confidence < 0.45 ? "You do not need perfect wording. Focus on clear, truthful execution examples." : "Keep confidence anchored in concrete delivery examples.",
    pacingGuidance,
    objectionHandling,
    identityAlignment,
  };
}
