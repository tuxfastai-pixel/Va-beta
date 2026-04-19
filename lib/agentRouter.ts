import { detectIntent } from "./taskOrchestrator"

export function selectAgent(message: string) {
  const intent = detectIntent(message)

  if (intent === "training") return "instructor"

  if (intent === "job_hunt") return "jobHunter"

  if (intent === "work_assistant") return "workAssistant"

  return "careerCoach"
}
