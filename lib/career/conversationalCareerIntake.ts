export type ConversationalCareerIntake = {
  background: string
  education: string[]
  experience: string[]
  skills: string[]
  preferences: string[]
  internationalSignals: string[]
}

const SEARCH_TERMS = {
  education: ["degree", "diploma", "certificate", "certification", "studied", "school", "university"],
  experience: ["worked", "helped", "managed", "assisted", "did", "freelance", "intern", "volunteer"],
  skills: ["excel", "writing", "computer", "customer", "teaching", "admin", "sales", "support", "language", "design"],
  preferences: ["remote", "hybrid", "international", "contract", "full-time", "part-time"],
  internationalSignals: ["timezone", "global", "international", "relocate", "english", "multilingual"],
}

function collect(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase()
  return Array.from(new Set(terms.filter((term) => lower.includes(term))))
}

export function parseConversationalCareerIntake(text: string): ConversationalCareerIntake {
  const background = text.trim().slice(0, 500)

  return {
    background,
    education: collect(text, SEARCH_TERMS.education),
    experience: collect(text, SEARCH_TERMS.experience),
    skills: collect(text, SEARCH_TERMS.skills),
    preferences: collect(text, SEARCH_TERMS.preferences),
    internationalSignals: collect(text, SEARCH_TERMS.internationalSignals),
  }
}
