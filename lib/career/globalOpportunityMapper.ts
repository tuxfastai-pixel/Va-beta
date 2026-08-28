export function mapGlobalOpportunities(roleNames: string[]): Array<{ role: string; category: string; fit: number }> {
  return roleNames.map((role) => {
    const lower = role.toLowerCase()
    const category = lower.includes("teach") || lower.includes("tutor") ? "education" : lower.includes("support") ? "operations" : lower.includes("write") ? "content" : "general"

    return {
      role,
      category,
      fit: lower.includes("remote") ? 0.9 : 0.75,
    }
  })
}
