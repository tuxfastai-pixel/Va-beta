export const CV_REGENERATION_FEEDBACK_MIN_LENGTH = 5
export const CV_REGENERATION_FEEDBACK_MAX_LENGTH = 500

export const getCvFeedbackValidationError = (
  feedback: string
): string | null => {
  const length = feedback.trim().length

  if (
    length < CV_REGENERATION_FEEDBACK_MIN_LENGTH ||
    length > CV_REGENERATION_FEEDBACK_MAX_LENGTH
  ) {
    return "Feedback must be between 5 and 500 characters."
  }

  return null
}

export const isValidCvRegenerationFeedback = (
  feedback: string
) => getCvFeedbackValidationError(feedback) === null

export const validateAlternativeFeedback = (
  value: unknown
): { feedback: string; error: string | null } => {
  if (typeof value !== "string") {
    return {
      feedback: "",
      error: "Feedback must be between 5 and 500 characters.",
    }
  }

  const feedback = value.trim()
  return {
    feedback,
    error: getCvFeedbackValidationError(feedback),
  }
}

export type CvFeedbackState = {
  feedbackByChange: Record<string, string>
  errorsByChange: Record<string, string>
}

export type CvFeedbackAction =
  | { type: "feedback_changed"; changeId: string; value: string }
  | { type: "validation_requested"; changeId: string }
  | { type: "reconsidered"; changeId: string }
  | { type: "continued" }
  | { type: "rejected"; changeId: string }
  | { type: "regeneration_failed"; changeId: string }

export const initialCvFeedbackState: CvFeedbackState = {
  feedbackByChange: {},
  errorsByChange: {},
}

export function reduceCvFeedbackState(
  state: CvFeedbackState,
  action: CvFeedbackAction
): CvFeedbackState {
  if (
    action.type === "rejected" ||
    action.type === "regeneration_failed"
  ) {
    return state
  }

  if (action.type === "continued") {
    return { ...state, errorsByChange: {} }
  }

  if (action.type === "reconsidered") {
    const feedbackByChange = { ...state.feedbackByChange }
    const errorsByChange = { ...state.errorsByChange }
    delete feedbackByChange[action.changeId]
    delete errorsByChange[action.changeId]
    return { feedbackByChange, errorsByChange }
  }

  if (action.type === "validation_requested") {
    const error = getCvFeedbackValidationError(
      state.feedbackByChange[action.changeId] || ""
    )
    const errorsByChange = { ...state.errorsByChange }
    if (error) errorsByChange[action.changeId] = error
    else delete errorsByChange[action.changeId]
    return { ...state, errorsByChange }
  }

  const feedbackByChange = {
    ...state.feedbackByChange,
    [action.changeId]: action.value,
  }
  const errorsByChange = { ...state.errorsByChange }
  if (isValidCvRegenerationFeedback(action.value)) {
    delete errorsByChange[action.changeId]
  }
  return { feedbackByChange, errorsByChange }
}
