export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export type PostWizardStage =
  | "activation_complete"
  | "cv_intake"
  | "ai_profile_review"
  | "cv_improvement_review"
  | "career_identity_summary"
  | "recommended_jobs"
  | "job_assessment"

export type CareerActivationStage =
  | "complete"
  | "cv-intake"
  | "profile-review"
  | "cv-improvements"
  | "career-summary"
  | "job-discovery"
  | "job-assessment"
  | "application-pack"
  | "interview-prep"

export type RecommendationBand =
  | "recommended_to_apply"
  | "possible_with_preparation"
  | "not_currently_recommended"

export type SkillState = "Missing" | "Learning" | "Practised" | "Demonstrated" | "Verified"

export type PaymentReadinessSnapshot = {
  selectedAccounts: string[]
  accountHolderName: string
  accountEmail: string
  payoutCurrency: string
  paymentReadinessScore: number
  paymentMissing: string[]
}

export type InternationalReadinessSnapshot = {
  remoteReadinessScore: number
  profileCompletionScore: number
  internationalReadinessScore: number
}

export type OnboardingProgressPayload = {
  name: string
  email: string
  skillTrack: string
  selectedCareers: string[]
  primaryCareer: string
  secondaryCareers: string[]
  paymentReadiness: PaymentReadinessSnapshot
  internationalReadiness: InternationalReadinessSnapshot
}

export type ActivationStateRecord = {
  userId: string
  onboardingCompleted: boolean
  completedStep: number
  lastValidStep: OnboardingStep
  completionTimestamp: string | null
  answers: Record<string, unknown>
  careerLanes: {
    selected: string[]
    primary: string
    secondary: string[]
  }
  paymentReadiness: PaymentReadinessSnapshot
  internationalReadiness: InternationalReadinessSnapshot
  continuityCheckpoint: Record<string, unknown>
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildContinuityCheckpoint(input: {
  userId: string
  completedStep: OnboardingStep
  payload: OnboardingProgressPayload
}) {
  return {
    userId: input.userId,
    completedStep: input.completedStep,
    completionTimestamp: new Date().toISOString(),
    careerLanes: {
      selected: input.payload.selectedCareers,
      primary: input.payload.primaryCareer,
      secondary: input.payload.secondaryCareers,
    },
    paymentReadiness: input.payload.paymentReadiness,
    internationalReadiness: input.payload.internationalReadiness,
    identitySummary: {
      name: input.payload.name,
      email: input.payload.email,
      skillTrack: input.payload.skillTrack,
    },
  }
}

export function sanitizeStep(value: number): OnboardingStep {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.min(5, Math.floor(value))) as OnboardingStep
}

export function resolveResumeStepOnLoad(state: ActivationStateRecord | null): {
  onboardingStep: OnboardingStep
  nextStage: PostWizardStage
  completed: boolean
} {
  if (!state) {
    return {
      onboardingStep: 1,
      nextStage: "activation_complete",
      completed: false,
    }
  }

  if (state.onboardingCompleted || state.completedStep >= 5) {
    return {
      onboardingStep: 5,
      nextStage: "activation_complete",
      completed: true,
    }
  }

  return {
    onboardingStep: sanitizeStep(state.lastValidStep),
    nextStage: "activation_complete",
    completed: false,
  }
}

export function requireRestartConfirmation(input: { confirm: boolean; reason?: string }) {
  if (!input.confirm) {
    throw new Error("Restart onboarding requires explicit confirmation.")
  }

  const reason = String(input.reason || "").trim()
  return {
    confirmed: true,
    reason: reason || "user_requested_restart",
  }
}

export function resolveRecommendationBand(score: number): RecommendationBand {
  if (score >= 75) {
    return "recommended_to_apply"
  }

  if (score >= 60) {
    return "possible_with_preparation"
  }

  return "not_currently_recommended"
}

export function canClaimSkillOnCv(state: SkillState) {
  return state === "Demonstrated" || state === "Verified"
}

// Career activation journey stage management

const STAGE_SEQUENCE: CareerActivationStage[] = [
  "complete",
  "cv-intake",
  "profile-review",
  "cv-improvements",
  "career-summary",
  "job-discovery",
  "job-assessment",
  "application-pack",
  "interview-prep",
]

export function isValidStage(stage: unknown): stage is CareerActivationStage {
  return typeof stage === "string" && STAGE_SEQUENCE.includes(stage as CareerActivationStage)
}

export function getNextStage(current: CareerActivationStage): CareerActivationStage | null {
  const index = STAGE_SEQUENCE.indexOf(current)
  if (index === -1 || index >= STAGE_SEQUENCE.length - 1) {
    return null
  }
  return STAGE_SEQUENCE[index + 1]
}

export function getPreviousStage(current: CareerActivationStage): CareerActivationStage | null {
  const index = STAGE_SEQUENCE.indexOf(current)
  if (index <= 0) {
    return null
  }
  return STAGE_SEQUENCE[index - 1]
}

export function getStageIndex(stage: CareerActivationStage): number {
  return STAGE_SEQUENCE.indexOf(stage)
}

export function getStageTitle(stage: CareerActivationStage): string {
  const titles: Record<CareerActivationStage, string> = {
    complete: "Career Activation",
    "cv-intake": "Upload Your CV",
    "profile-review": "Profile Review",
    "cv-improvements": "CV Improvements",
    "career-summary": "Career Identity",
    "job-discovery": "Find a Job",
    "job-assessment": "Job Assessment",
    "application-pack": "Application Pack",
    "interview-prep": "Interview Preparation",
  }
  return titles[stage]
}

export function validateStageTransition(from: CareerActivationStage, to: CareerActivationStage): boolean {
  const fromIndex = getStageIndex(from)
  const toIndex = getStageIndex(to)

  if (fromIndex === -1 || toIndex === -1) {
    return false
  }

  // Can only move forward or stay at current stage
  return toIndex >= fromIndex
}
