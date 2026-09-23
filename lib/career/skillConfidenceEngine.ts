import type { NormalizedResume } from "./careerTypes.ts"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

const SIGNALS = [
  "communication",
  "writing",
  "customer",
  "training",
  "admin",
  "digital",
  "remote",
  "analysis",
  "coordination",
  "leadership",
]

export function scoreSkillConfidence(resume: NormalizedResume, conversationText = ""): Record<string, number> {
  const text = `${resume.cleanText} ${conversationText}`.toLowerCase()

  return Object.fromEntries(
    SIGNALS.map((signal) => {
      const evidence = text.includes(signal) ? 1 : resume.skillSignals.some((item) => item.includes(signal)) ? 0.75 : 0.2
      return [signal, clamp01(evidence)]
    }),
  )
}
