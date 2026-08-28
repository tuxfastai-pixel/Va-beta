export function buildRemotePositioningSummary(input: {
  skills: string[]
  confidence: number
  timezoneFlexibility: "local" | "regional" | "global"
}): string {
  const skills = input.skills.slice(0, 6).join(", ") || "cross-functional collaboration"
  const timezoneLine =
    input.timezoneFlexibility === "global"
      ? "comfortable with global timezone collaboration"
      : input.timezoneFlexibility === "regional"
        ? "available for regional timezone overlap"
        : "best aligned with local timezone schedules"

  return `Remote-ready profile with strengths in ${skills}; ${timezoneLine}; confidence score ${Math.round(input.confidence * 100)}%.`
}
