import { supabaseServer } from "@/lib/supabaseServer"
import {
  assessJobFit,
  parseJobDescription,
} from "@/lib/career/jobAssessment"

type JsonRecord = Record<string, unknown>

type SourceJob = {
  source: "Remotive" | "Remote OK"
  externalId: string
  title: string
  company: string
  description: string
  location: string
  salary: string
  applyUrl: string
  publishedAt: string | null
}

type CareerEvidence = {
  skills: string[]
  pendingSkills: string[]
  evidenceText: string[]
  preferredRoles: string[]
  paymentReadiness: number
}

export type OpportunityHunterResult = {
  discovered: number
  accepted: number
  rejected: number
  recommended: number
  sources: string[]
  searchedAt: string
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => typeof item === "object" && item !== null)
    : []
}

function cleanHtml(value: unknown): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function safeUrl(value: unknown): string {
  try {
    const url = new URL(String(value || ""))
    return url.protocol === "https:" ? url.toString() : ""
  } catch {
    return ""
  }
}

function fingerprint(job: SourceJob): string {
  return [
    job.source,
    job.externalId || job.applyUrl,
    job.title,
    job.company,
  ]
    .join("|")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 180)
}

function isLocationEligible(location: string): boolean {
  if (!location.trim()) return true
  return /worldwide|anywhere|global|south africa|africa|emea|multiple locations|international/i.test(location)
}

function scamRisk(job: SourceJob): number {
  const text = `${job.title} ${job.company} ${job.description}`
  if (/pay (?:a |the )?(?:fee|deposit)|training fee|crypto investment|purchase equipment from us|telegram only|whatsapp only|guaranteed income/i.test(text)) {
    return 0.95
  }
  if (!job.company || !job.applyUrl || job.description.length < 120) {
    return 0.55
  }
  return 0.12
}

function qualityScore(job: SourceJob): number {
  let score = 35
  if (job.company) score += 15
  if (job.description.length >= 300) score += 20
  else if (job.description.length >= 120) score += 10
  if (job.applyUrl) score += 15
  if (job.location) score += 5
  if (job.salary) score += 5
  if (job.publishedAt) score += 5
  return Math.min(100, score)
}

function roleAlignment(job: SourceJob, roles: string[]): number {
  const haystack = `${job.title} ${job.description}`.toLowerCase()
  const roleTokens = roles
    .flatMap((role) => role.toLowerCase().split(/[^a-z0-9]+/))
    .filter((token) => token.length >= 4)
  if (roleTokens.length === 0) return 45
  const unique = Array.from(new Set(roleTokens))
  const hits = unique.filter((token) => haystack.includes(token)).length
  return Math.round((hits / unique.length) * 100)
}

function matchOpportunity(job: SourceJob, profile: CareerEvidence) {
  const parsed = parseJobDescription({
    title: job.title,
    description: job.description,
    location: job.location,
    salary: job.salary,
  })
  const fit = assessJobFit({
    parsedJob: parsed,
    profile: {
      translatedSkills: profile.skills,
      hiddenSkills: profile.pendingSkills,
      evidenceText: profile.evidenceText,
      profileConfidence: profile.skills.length >= 5 ? 0.85 : profile.skills.length > 0 ? 0.65 : 0.35,
      internationalPaymentReadinessScore: profile.paymentReadiness,
    },
  })
  const alignment = roleAlignment(job, profile.preferredRoles)
  const evidenceScore =
    parsed.requiredSkills.length > 0
      ? fit.scores.matchScore
      : alignment
  const matchScore = Math.max(
    0,
    Math.min(100, Math.round(evidenceScore * 0.8 + alignment * 0.2))
  )

  return {
    matchScore,
    verifiedSkills: fit.verifiedSkills,
    transferableSkills: fit.transferableSkills,
    missingSkills: fit.missingSkills,
  }
}

async function fetchRemotive(): Promise<SourceJob[]> {
  const response = await fetch("https://remotive.com/api/remote-jobs", {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  })
  if (!response.ok) throw new Error(`Remotive returned ${response.status}`)
  const payload = (await response.json()) as JsonRecord
  return records(payload.jobs).slice(0, 250).map((job) => ({
    source: "Remotive",
    externalId: String(job.id || job.url || ""),
    title: cleanHtml(job.title),
    company: cleanHtml(job.company_name),
    description: cleanHtml(job.description),
    location: cleanHtml(job.candidate_required_location),
    salary: cleanHtml(job.salary),
    applyUrl: safeUrl(job.url),
    publishedAt: String(job.publication_date || "").trim() || null,
  }))
}

async function fetchRemoteOk(): Promise<SourceJob[]> {
  const response = await fetch("https://remoteok.com/api", {
    headers: {
      Accept: "application/json",
      "User-Agent": "VA-Beta Opportunity Hunter (source attribution enabled)",
    },
    next: { revalidate: 3600 },
  })
  if (!response.ok) throw new Error(`Remote OK returned ${response.status}`)
  const payload = await response.json()
  return records(payload).filter((job) => job.position || job.title).slice(0, 250).map((job) => ({
    source: "Remote OK",
    externalId: String(job.id || job.slug || job.url || ""),
    title: cleanHtml(job.position || job.title),
    company: cleanHtml(job.company),
    description: cleanHtml(job.description),
    location: cleanHtml(job.location || "Worldwide"),
    salary: cleanHtml(job.salary || [job.salary_min, job.salary_max].filter(Boolean).join(" - ")),
    applyUrl: safeUrl(job.url || job.apply_url),
    publishedAt: String(job.date || job.epoch || "").trim() || null,
  }))
}

async function loadCareerEvidence(userId: string): Promise<CareerEvidence> {
  const [profileResult, activationResult] = await Promise.all([
    supabaseServer
      .from("master_career_profiles")
      .select("structured_profile")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from("career_activation_states")
      .select("career_lanes,payment_readiness")
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  if (profileResult.error) throw new Error(profileResult.error.message)
  if (!profileResult.data) throw new Error("Complete your Career Profile before searching for jobs.")

  const structured = (profileResult.data.structured_profile || {}) as JsonRecord
  const lanes = (activationResult.data?.career_lanes || {}) as JsonRecord
  const payment = (activationResult.data?.payment_readiness || {}) as JsonRecord

  const pendingSkills = records(structured.skillsNeedingConfirmation)
    .map((item) => String(item.skill || "").trim())
    .filter(Boolean)

  const laneRoles = [
    String(lanes.primary || "").trim(),
    ...strings(lanes.secondary),
  ].filter(Boolean)

  return {
    skills: strings(structured.skills),
    pendingSkills,
    evidenceText: [
      ...strings(structured.workExperience),
      ...strings(structured.projects),
      ...strings(structured.achievements),
      ...strings(structured.certifications),
    ],
    preferredRoles: Array.from(new Set([
      ...strings(structured.preferredRoles),
      ...laneRoles,
    ])),
    paymentReadiness: Number(payment.paymentReadinessScore ?? structured.internationalPaymentReadiness ?? 50),
  }
}

async function persistOpportunity(
  userId: string,
  job: SourceJob,
  scoring: ReturnType<typeof matchOpportunity>,
  quality: number,
  risk: number,
) {
  const sourceBlock = [
    "",
    `Source: ${job.source}`,
    `Location: ${job.location || "Not specified"}`,
    job.salary ? `Salary: ${job.salary}` : "",
    `Application link: ${job.applyUrl}`,
    `Opportunity fingerprint: ${fingerprint(job)}`,
  ].filter(Boolean).join("\n")

  const description = `${job.description}${sourceBlock}`
  const { data: existing, error: existingError } = await supabaseServer
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("title", job.title)
    .eq("company", job.company)
    .limit(1)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)

  const values = {
    description,
    match_score: scoring.matchScore,
    quality_score: quality,
    scam_risk: risk.toFixed(2),
    quality_reason:
      `${job.source} public feed; ${scoring.verifiedSkills.length} direct and ${scoring.transferableSkills.length} transferable evidence matches.`,
  }

  if (existing?.id) {
    const { error } = await supabaseServer.from("jobs").update(values).eq("id", existing.id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabaseServer.from("jobs").insert({
    user_id: userId,
    title: job.title,
    company: job.company || "Company not provided",
    ...values,
  })
  if (error) throw new Error(error.message)
}

export async function runOpportunityHunter(userId: string): Promise<OpportunityHunterResult> {
  const profile = await loadCareerEvidence(userId)
  const settled = await Promise.allSettled([fetchRemotive(), fetchRemoteOk()])
  const sources: string[] = []
  const raw: SourceJob[] = []

  if (settled[0].status === "fulfilled") {
    raw.push(...settled[0].value)
    sources.push("Remotive")
  }
  if (settled[1].status === "fulfilled") {
    raw.push(...settled[1].value)
    sources.push("Remote OK")
  }
  if (sources.length === 0) {
    throw new Error("Approved job feeds are temporarily unavailable.")
  }

  const unique = Array.from(
    new Map(raw.filter((job) => job.title && job.applyUrl).map((job) => [fingerprint(job), job])).values()
  )

  const ranked = unique
    .map((job) => {
      const risk = scamRisk(job)
      const quality = qualityScore(job)
      const scoring = matchOpportunity(job, profile)
      return { job, risk, quality, scoring }
    })
    .filter(({ job, risk, quality, scoring }) =>
      risk < 0.6 &&
      quality >= 60 &&
      isLocationEligible(job.location) &&
      scoring.matchScore >= 35
    )
    .sort((a, b) => b.scoring.matchScore - a.scoring.matchScore)
    .slice(0, 20)

  for (const item of ranked) {
    await persistOpportunity(userId, item.job, item.scoring, item.quality, item.risk)
  }

  return {
    discovered: unique.length,
    accepted: ranked.length,
    rejected: unique.length - ranked.length,
    recommended: ranked.filter((item) => item.scoring.matchScore >= 75).length,
    sources,
    searchedAt: new Date().toISOString(),
  }
}
