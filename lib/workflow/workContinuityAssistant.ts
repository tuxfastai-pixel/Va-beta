export function buildWorkContinuityPlan(input: {
  role: string
  workloadLevel: "low" | "medium" | "high"
  timezone: string
}) {
  const workloadLevel = input.workloadLevel

  return {
    role: input.role,
    onboardingChecklist: [
      "Set first-week outcomes with manager",
      "Capture role glossary and recurring workflows",
      "Create communication templates",
      "Define escalation and support channels",
    ],
    dailyStructure:
      workloadLevel === "high"
        ? ["Plan top 3 tasks", "90-minute focus block", "15-minute reset", "Status summary"]
        : ["Plan top 2 tasks", "60-minute focus block", "Quick review"],
    continuityGuardrails: [
      "Avoid context-switching more than 4 times per hour",
      "Document blockers before switching tasks",
      "Escalate early when dependencies are unclear",
    ],
    timezoneCoordination: `Primary coordination timezone: ${input.timezone}`,
  }
}
