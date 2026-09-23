export type NormalizedJob = {
  id: string
  title: string
  company: string
  location: string
  remote: boolean
  salaryRange: string | null
  source: string
  description: string
}

export function normalizeJob(raw: Record<string, unknown>): NormalizedJob {
  const title = String(raw.title || raw.role || "Untitled role")
  const company = String(raw.company || raw.employer || "Unknown company")
  const location = String(raw.location || "Unknown")
  const description = String(raw.description || raw.summary || "")
  const source = String(raw.source || "internal")

  return {
    id: String(raw.id || `${source}-${title}-${company}`.toLowerCase().replace(/\s+/g, "-")),
    title,
    company,
    location,
    remote: Boolean(raw.remote ?? location.toLowerCase().includes("remote")),
    salaryRange: raw.salaryRange ? String(raw.salaryRange) : null,
    source,
    description,
  }
}
