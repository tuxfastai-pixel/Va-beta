import { translateToProfessionalLanguage } from "./professionalLanguageTranslator.ts"

export function buildCareerNarrative(input: {
  summary: string
  skills: string[]
  goals: string[]
}): string {
  const skillLine = input.skills.length > 0 ? `Core strengths: ${input.skills.slice(0, 6).join(", ")}.` : ""
  const goalLine = input.goals.length > 0 ? `Target roles: ${input.goals.slice(0, 4).join(", ")}.` : ""
  return translateToProfessionalLanguage([input.summary, skillLine, goalLine].filter(Boolean).join(" ")).trim()
}
