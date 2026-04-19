export function detectIntent(message: string) {
  const text = message.toLowerCase()

  if (
    text.includes("learn") ||
    text.includes("teach") ||
    text.includes("training")
  ) {
    return "training"
  }

  if (
    text.includes("job") ||
    text.includes("apply") ||
    text.includes("vacancy")
  ) {
    return "job_hunt"
  }

  if (
    text.includes("client") ||
    text.includes("email") ||
    text.includes("report")
  ) {
    return "work_assistant"
  }

  return "career_coach"
}
