import { mapTransferableSkills } from "./transferableSkillEngine.ts"

export function expandCapabilities(signals: string[]): { primarySkill: string; opportunities: string[] }[] {
  return mapTransferableSkills(signals).map((entry) => ({
    primarySkill: entry.skill,
    opportunities: entry.roles,
  }))
}
