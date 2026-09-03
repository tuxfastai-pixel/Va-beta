export type ConfirmationStatus =
  | "not_required"
  | "needs_confirmation"
  | "confirmed"

export type ConfirmationQuestion = {
  id: string
  prompt: string
}

export type ConfirmationAnswers =
  Record<string, string>

const MAX_QUESTIONS = 5
const MAX_PROMPT_LENGTH = 240
const MAX_ANSWER_LENGTH = 500

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function cleanText(
  value: unknown,
  maximumLength: number
): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength)
}

function cleanQuestionId(
  value: unknown
): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export function validateConfirmationQuestions(
  value: unknown
): ConfirmationQuestion[] {
  if (!Array.isArray(value)) {
    return []
  }

  const questions: ConfirmationQuestion[] = []
  const seen = new Set<string>()

  for (const item of value.slice(0, MAX_QUESTIONS)) {
    if (!isRecord(item)) {
      continue
    }

    const id = cleanQuestionId(item.id)
    const prompt = cleanText(
      item.prompt,
      MAX_PROMPT_LENGTH
    )

    if (!id || !prompt || seen.has(id)) {
      continue
    }

    seen.add(id)
    questions.push({ id, prompt })
  }

  return questions
}

export function validateConfirmationAnswers(
  questions: ConfirmationQuestion[],
  value: unknown
): {
  answers: ConfirmationAnswers
  missingQuestionIds: string[]
} {
  const source =
    isRecord(value) ? value : {}

  const answers: ConfirmationAnswers = {}
  const missingQuestionIds: string[] = []

  for (const question of questions) {
    const answer = cleanText(
      source[question.id],
      MAX_ANSWER_LENGTH
    )

    if (!answer) {
      missingQuestionIds.push(question.id)
      continue
    }

    answers[question.id] = answer
  }

  return {
    answers,
    missingQuestionIds,
  }
}

export function buildConfirmedEvidence(
  sourceEvidence: string,
  questions: ConfirmationQuestion[],
  answers: ConfirmationAnswers
): string {
  const source = cleanText(
    sourceEvidence,
    4000
  )

  const confirmations =
    questions
      .map((question) => {
        const answer =
          cleanText(
            answers[question.id],
            MAX_ANSWER_LENGTH
          )

        if (!answer) {
          return ""
        }

        return [
          `Question: ${question.prompt}`,
          `Confirmed answer: ${answer}`,
        ].join("\n")
      })
      .filter(Boolean)

  return [
    source
      ? `Source CV evidence:\n${source}`
      : "",
    confirmations.length > 0
      ? [
          "User-confirmed evidence:",
          confirmations.join("\n\n"),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function canApproveCvChange(
  confirmationStatus: ConfirmationStatus
): boolean {
  return (
    confirmationStatus === "not_required" ||
    confirmationStatus === "confirmed"
  )
}