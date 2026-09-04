import type { CareerPreference } from "./careerTypes.ts"

export function resolveWorkPreferences(input: {
  conversationText?: string | null
  answers?: Record<string, string | boolean | string[] | number | null>
  preferences?: Partial<CareerPreference>
}): CareerPreference {
  const text = `${input.conversationText || ""} ${JSON.stringify(input.answers || {})}`.toLowerCase()
  const wantsInternational = text.includes("international") || text.includes("global")
  const prefersQuietMode = text.includes("quiet") || text.includes("low notification")

  const remote = Boolean(input.preferences?.remote ?? text.includes("remote"))
  const hybrid = Boolean(input.preferences?.hybrid ?? text.includes("hybrid"))
  const international = Boolean(input.preferences?.international ?? wantsInternational)
  const contract = Boolean(input.preferences?.contract ?? text.includes("contract"))
  const fullTime = Boolean(input.preferences?.fullTime ?? !text.includes("part-time"))
  const timezoneFlexibility = input.preferences?.timezoneFlexibility
    ?? (text.includes("global") ? "global" : text.includes("region") ? "regional" : "local")
  const pacingPreference = input.preferences?.pacingPreference
    ?? (text.includes("slow") ? "slow" : text.includes("fast") ? "fast" : "balanced")
  const quietMode = Boolean(input.preferences?.quietMode ?? prefersQuietMode)

  return {
    remote,
    hybrid,
    international,
    contract,
    fullTime,
    timezoneFlexibility,
    pacingPreference,
    quietMode,
  }
}
