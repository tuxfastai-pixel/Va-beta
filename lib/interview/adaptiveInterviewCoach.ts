import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"

export function getAdaptiveInterviewCoaching(input: {
  profile: CareerIdentityProfile
  fatigueRisk?: number
  anxietyLevel?: number
}) {
  const fatigueRisk = Math.max(0, Math.min(1, input.fatigueRisk ?? 0.3))
  const anxietyLevel = Math.max(0, Math.min(1, input.anxietyLevel ?? 0.35))
  const seniority = input.profile.seniorityTier || "entry"
  const transitionDetected = Boolean(input.profile.identityLayer?.transitionDetected)

  const mode = fatigueRisk > 0.6 || anxietyLevel > 0.6
    ? "calm-mode"
    : seniority === "senior"
      ? "executive-mode"
      : transitionDetected
        ? "transition-mode"
        : seniority === "entry"
          ? "foundation-mode"
          : "standard-mode"

  return {
    mode,
    prompts:
      mode === "calm-mode"
        ? [
            "Take your time; a short and clear answer is enough.",
            "You can ask for the question to be repeated.",
            "Focus on one concrete example.",
          ]
        : mode === "executive-mode"
          ? [
              "Lead with business impact and measurable outcomes.",
              "Show how you balance risk, speed, and stakeholder trust.",
              "Use one strategic example and one people-leadership example.",
              "Close with how you would scale results in the first 90 days.",
            ]
          : mode === "transition-mode"
            ? [
                "Start by naming your transferable strengths clearly.",
                "Bridge past context to this role with one concrete example.",
                "Acknowledge the transition, then show your ramp-up plan.",
                "End with confidence in your ability to deliver quickly.",
              ]
            : mode === "foundation-mode"
              ? [
                  "Keep answers structured and simple.",
                  "Use one clear example per question.",
                  "Highlight reliability, learning speed, and communication.",
                  "Close with what support helps you perform best.",
                ]
        : [
            "Open with your strongest result.",
            "Link your answer to role impact.",
            "Close with what you would improve next time.",
          ],
    pacingPlan: {
      sessionMinutes: mode === "calm-mode" ? 12 : mode === "executive-mode" ? 24 : 20,
      breakEveryMinutes: mode === "calm-mode" ? 4 : mode === "executive-mode" ? 10 : 8,
    },
    trustSafeguard: "All recommendations are assistive; no autonomous interview actions are executed.",
  }
}
