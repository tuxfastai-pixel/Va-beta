export function mapTransferableSkills(signals: string[]): { skill: string; roles: string[] }[] {
  const normalized = Array.from(new Set(signals.map((value) => value.toLowerCase())))

  const mapping: Record<string, string[]> = {
    teaching: ["instructional design", "online tutoring", "training coordination"],
    admin: ["virtual assistant", "crm coordination", "support operations"],
    writing: ["content writing", "documentation support", "copywriting"],
    customer: ["customer success", "client onboarding", "support specialist"],
    support: ["customer success", "helpdesk operations", "service coordination"],
    data: ["data operations", "reporting support", "research assistance"],
    excel: ["reporting support", "operations coordination", "crm support"],
    computer: ["digital operations", "productivity support", "remote collaboration"],
    sales: ["sales support", "lead qualification", "client outreach"],
  }

  return normalized.flatMap((signal) => {
    const entry = Object.entries(mapping).find(([key]) => signal.includes(key))
    return entry ? [{ skill: entry[0], roles: entry[1] }] : []
  })
}
