export type ExplainabilityFactor = {
  key: string
  value: number | string | boolean
  threshold?: number
  direction?: "above" | "below"
  label?: string
}

export type ExplainabilityInput = {
  decision: string
  category: "pacing" | "workspace" | "notifications" | "autonomy" | "recovery" | "trust" | "governance"
  factors: ExplainabilityFactor[]
  context?: string
}

export type ExplainabilityOutput = {
  summary: string
  detail: string
  technicalExplanation: string
  operatorExplanation: string
  calmUserExplanation: string
  factors: Array<ExplainabilityFactor & { triggerMatched: boolean }>
}

function toNumber(value: number | string | boolean): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function factorMatched(factor: ExplainabilityFactor): boolean {
  if (typeof factor.threshold !== "number") {
    return false
  }

  const numeric = toNumber(factor.value)
  if (numeric === null) {
    return false
  }

  if (factor.direction === "below") {
    return numeric <= factor.threshold
  }

  return numeric >= factor.threshold
}

function summaryForDecision(input: ExplainabilityInput): string {
  if (input.category === "pacing") {
    return "The system slowed activity because interaction pressure was rising faster than recovery confidence."
  }
  if (input.category === "workspace") {
    return "Workspace density was reduced to preserve cognitive clarity under increasing load."
  }
  if (input.category === "notifications") {
    return "Notification cadence was downshifted to reduce interruption pressure and preserve focus continuity."
  }
  if (input.category === "autonomy") {
    return "Automation was throttled to preserve consistency and predictability while trust signals were unstable."
  }
  if (input.category === "recovery") {
    return "Recovery guidance activated because overload risk exceeded stable operating thresholds."
  }
  if (input.category === "trust") {
    return "Trust-oriented safeguards were applied to keep adaptation psychologically sustainable."
  }
  return "A governance safeguard was applied to preserve user stability and continuity."
}

function buildLayeredExplanations(input: ExplainabilityInput, matchedText: string) {
  const technicalExplanation = `${input.decision} triggered for ${input.category}; ${matchedText}.`
  const operatorExplanation = `The system adjusted ${input.category} behavior because recent signals crossed configured stability thresholds. ${matchedText}.`
  const calmUserExplanation = input.category === "autonomy"
    ? "The system is moving more carefully to keep your experience consistent."
    : input.category === "recovery"
      ? "The system shifted into a steadier mode to help restore focus and continuity."
      : "The system made a small adjustment to keep your experience steady and reduce strain."

  return {
    technicalExplanation,
    operatorExplanation,
    calmUserExplanation,
  }
}

export function explainGovernanceDecision(input: ExplainabilityInput): ExplainabilityOutput {
  const evaluatedFactors = input.factors.map((factor) => ({
    ...factor,
    triggerMatched: factorMatched(factor),
  }))

  const matched = evaluatedFactors.filter((factor) => factor.triggerMatched)
  const matchedText =
    matched.length > 0
      ? matched
          .map((factor) => {
            const label = factor.label || factor.key
            const thresholdText =
              typeof factor.threshold === "number"
                ? ` (${factor.direction === "below" ? "<=" : ">="} ${factor.threshold})`
                : ""
            return `${label}=${String(factor.value)}${thresholdText}`
          })
          .join(", ")
      : "no explicit threshold triggers"

  const detail = [
    `Decision: ${input.decision}`,
    input.context ? `Context: ${input.context}` : null,
    `Triggered factors: ${matchedText}`,
  ]
    .filter(Boolean)
    .join(" | ")

  const layered = buildLayeredExplanations(input, matchedText)

  return {
    summary: summaryForDecision(input),
    detail,
    technicalExplanation: layered.technicalExplanation,
    operatorExplanation: layered.operatorExplanation,
    calmUserExplanation: layered.calmUserExplanation,
    factors: evaluatedFactors,
  }
}
