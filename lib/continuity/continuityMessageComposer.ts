import type { InterruptionCauseType } from "./sessionContinuityStore.ts"
import type { SessionResumePlan } from "./sessionResumeReconciler.ts"

export type ContinuityMessageInput = {
  plan: SessionResumePlan
  interruptionCause?: InterruptionCauseType
}

function confidenceLabel(confidence: number): "low" | "medium" | "high" {
  if (confidence < 0.45) {
    return "low"
  }
  if (confidence < 0.72) {
    return "medium"
  }
  return "high"
}

function causeHint(cause?: InterruptionCauseType): string {
  if (!cause) {
    return ""
  }

  if (cause === "browser_crash" || cause === "websocket_disconnect") {
    return "Your thread of work was preserved across the interruption."
  }

  if (cause === "api_failure" || cause === "partial_orchestration_failure") {
    return "We kept your direction steady while system pressure settled."
  }

  if (cause === "telemetry_corruption") {
    return "We prioritized a stable baseline so your next steps stay reliable."
  }

  if (cause === "interrupted_recovery_cycle" || cause === "interrupted_autonomous_regulation") {
    return "We continued your stabilization path without losing context."
  }

  if (cause === "mobile_background_resume") {
    return "Your progress remains intact across devices and timing gaps."
  }

  return "Your continuity signal has been kept steady."
}

export function composeContinuityMessage(input: ContinuityMessageInput): string {
  const { plan, interruptionCause } = input
  const confidence = confidenceLabel(plan.continuityConfidence)

  const headline =
    plan.decision === "resume"
      ? "You can continue where you left off."
      : plan.decision === "simplify"
        ? "We simplified things slightly to make re-entry easier."
        : plan.decision === "recover"
          ? "We shifted into a calm recovery path so your direction stays intact."
          : "We are taking a careful, steady re-entry to protect your momentum."

  const confidenceLine =
    confidence === "high"
      ? "Your direction signal is strong, so momentum is preserved."
      : confidence === "medium"
        ? "Your direction signal is solid, with gentle safeguards in place."
        : "Your direction signal is still forming, so we are keeping the next steps conservative."

  const pacingLine =
    plan.recommendedPacing === "steady"
      ? "Pacing will stay steady and familiar."
      : plan.recommendedPacing === "gentle"
        ? "Pacing will remain gentle until flow feels natural again."
        : "Pacing will stay conservative until confidence rises."

  const hint = causeHint(interruptionCause)
  return [headline, confidenceLine, pacingLine, hint].filter(Boolean).join(" ")
}
