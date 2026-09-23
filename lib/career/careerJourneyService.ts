import { supabaseServer } from "@/lib/supabaseServer"
import { isValidStage, getNextStage, validateStageTransition, type CareerActivationStage } from "./activationContinuity.ts"

export type JourneyState = {
  userId: string
  currentStage: CareerActivationStage
  completedStages: CareerActivationStage[]
  careerActivationCompleted: boolean
  lastJobId: string | null
  lastAssessmentId: string | null
  lastCvVersionId: string | null
  updatedAt: string
}

export async function getCurrentJourneyStage(userId: string): Promise<CareerActivationStage | null> {
  if (!userId) {
    return null
  }

  const { data, error } = await supabaseServer
    .from("career_activation_states")
    .select("current_stage")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const stage = data.current_stage
  if (isValidStage(stage)) {
    return stage
  }

  return null
}

export async function getFullJourneyState(userId: string): Promise<JourneyState | null> {
  if (!userId) {
    return null
  }

  const { data, error } = await supabaseServer
    .from("career_activation_states")
    .select(
      "current_stage, completed_stages, career_activation_completed, last_job_id, last_assessment_id, last_cv_version_id, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    userId,
    currentStage: isValidStage(data.current_stage) ? data.current_stage : "complete",
    completedStages: Array.isArray(data.completed_stages) ? data.completed_stages : [],
    careerActivationCompleted: Boolean(data.career_activation_completed),
    lastJobId: data.last_job_id || null,
    lastAssessmentId: data.last_assessment_id || null,
    lastCvVersionId: data.last_cv_version_id || null,
    updatedAt: data.updated_at,
  }
}

export async function transitionToStage(input: {
  userId: string
  fromStage: CareerActivationStage
  toStage: CareerActivationStage
  stageData?: Record<string, unknown>
}): Promise<{ success: boolean; error?: string }> {
  if (!input.userId) {
    return { success: false, error: "userId is required" }
  }

  if (!validateStageTransition(input.fromStage, input.toStage)) {
    return { success: false, error: "Invalid stage transition" }
  }

  const completedStages = new Set([input.fromStage])
  const currentState = await getFullJourneyState(input.userId)
  if (currentState?.completedStages) {
    currentState.completedStages.forEach((stage) => completedStages.add(stage))
  }

  const { error } = await supabaseServer
    .from("career_activation_states")
    .update({
      current_stage: input.toStage,
      completed_stages: Array.from(completedStages),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Optionally store stage-specific data
  if (input.stageData) {
    await supabaseServer
      .from("career_journey_state")
      .upsert({
        user_id: input.userId,
        stage_data: input.stageData,
        updated_at: new Date().toISOString(),
      })
  }

  return { success: true }
}

export async function markCareerActivationComplete(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: "userId is required" }
  }

  const { error } = await supabaseServer
    .from("career_activation_states")
    .update({
      career_activation_completed: true,
      current_stage: "interview-prep",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function resolveLoginRedirectStage(userId: string): Promise<{
  redirectTo: string
  reason: "completed_career_activation" | "resume_journey" | "start_onboarding" | "start_cv_intake"
}> {
  if (!userId) {
    return { redirectTo: "/onboarding", reason: "start_onboarding" }
  }

  const state = await getFullJourneyState(userId)

  // Completed entire journey
  if (state?.careerActivationCompleted) {
    return { redirectTo: "/dashboard", reason: "completed_career_activation" }
  }

  // In the middle of journey
  if (state?.currentStage && state.currentStage !== "complete") {
    return { redirectTo: `/career-activation/${state.currentStage}`, reason: "resume_journey" }
  }

  // Completed onboarding but haven't started CV
  const { data: onboarding } = await supabaseServer
    .from("career_activation_states")
    .select("onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle()

  if (onboarding?.onboarding_completed) {
    return { redirectTo: "/career-activation/cv-intake", reason: "start_cv_intake" }
  }

  // No progress, start onboarding
  return { redirectTo: "/onboarding", reason: "start_onboarding" }
}

export async function updateJourneyReferences(userId: string, refs: { jobId?: string; assessmentId?: string; cvVersionId?: string }): Promise<void> {
  const updates: Record<string, unknown> = {}

  if (refs.jobId) {
    updates.last_job_id = refs.jobId
  }
  if (refs.assessmentId) {
    updates.last_assessment_id = refs.assessmentId
  }
  if (refs.cvVersionId) {
    updates.last_cv_version_id = refs.cvVersionId
  }

  if (Object.keys(updates).length === 0) {
    return
  }

  updates.updated_at = new Date().toISOString()

  await supabaseServer
    .from("career_activation_states")
    .update(updates)
    .eq("user_id", userId)
}
