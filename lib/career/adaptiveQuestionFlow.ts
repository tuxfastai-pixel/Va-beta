import type { CareerQuestion } from "./careerTypes.ts"

export function buildAdaptiveCareerQuestions(input: {
  hasResume: boolean
  hasConversation: boolean
  hasPreferences: boolean
  fatigueRisk?: number
}): CareerQuestion[] {
  const questions: CareerQuestion[] = []

  if (!input.hasResume) {
    questions.push({
      id: "background",
      category: "background",
      prompt: "Tell us about your background in your own words.",
      required: true,
    })
  }

  if (!input.hasConversation) {
    questions.push({
      id: "skills",
      category: "skills",
      prompt: "What are you naturally good at, even if you have not listed it on a CV?",
      required: true,
    })
  }

  if (!input.hasPreferences) {
    questions.push({
      id: "work-preferences",
      category: "work-preferences",
      prompt: "What kind of work conditions feel safest and most sustainable for you?",
      required: true,
      options: ["Remote", "Hybrid", "International", "Contract", "Full-time"],
    })
  }

  if ((input.fatigueRisk ?? 0) > 0.6) {
    questions.push({
      id: "pacing",
      category: "work-preferences",
      prompt: "Would you like a slower, quieter onboarding pace?",
      required: false,
      options: ["Yes, slow it down", "Keep it balanced", "I can move faster"],
    })
  }

  if (questions.length === 0) {
    questions.push({
      id: "international-readiness",
      category: "international-readiness",
      prompt: "Are you open to remote or international roles?",
      required: true,
      options: ["Remote only", "Hybrid", "International", "Not sure yet"],
    })
  }

  return questions
}
