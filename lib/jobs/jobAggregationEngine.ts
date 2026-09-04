import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"
import { normalizeJob, type NormalizedJob } from "./jobNormalization.ts"
import { scoreJobTrust } from "./jobTrustScoring.ts"
import { scoreApplicationSuitability } from "./applicationSuitability.ts"

const STATIC_JOB_POOL: Array<Record<string, unknown>> = [
  {
    id: "remote-support-1",
    title: "Remote Customer Support Specialist",
    company: "Northline Services",
    location: "Remote - Global",
    remote: true,
    source: "remote-job-board",
    description: "Handle customer inquiries, escalation workflows, and CRM notes across distributed teams.",
  },
  {
    id: "ops-assistant-2",
    title: "Operations Assistant",
    company: "Atlas Ops",
    location: "Remote - EMEA",
    remote: true,
    source: "staffing-api",
    description: "Support scheduling, internal documentation, and coordination of onboarding workflows.",
  },
  {
    id: "content-coordinator-3",
    title: "Content and Documentation Coordinator",
    company: "BrightPath Learning",
    location: "Hybrid - Johannesburg",
    remote: false,
    source: "startup-feed",
    description: "Prepare learning assets, documentation updates, and communication summaries.",
  },
]

const JOB_REQUIRED_SKILL_HINTS = [
  "customer",
  "support",
  "crm",
  "operations",
  "documentation",
  "communication",
  "coordination",
  "scheduling",
  "remote",
  "admin",
]

function getRequiredSkillHints(job: NormalizedJob): string[] {
  const roleText = `${job.title} ${job.description}`.toLowerCase()
  const detected = JOB_REQUIRED_SKILL_HINTS.filter((hint) => roleText.includes(hint))
  return detected.length > 0 ? detected.slice(0, 10) : ["communication", "coordination", "support"]
}

function normalizeSkillToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function scoreIdentityAlignment(job: NormalizedJob, profile: CareerIdentityProfile): {
  score: number
  reason: string
} {
  const roleText = `${job.title} ${job.description}`.toLowerCase()
  const identity = profile.identityLayer

  if (!identity) {
    return { score: 0, reason: "Identity bridge not available yet" }
  }

  const matchedTrack = identity.targetTracks.find((track) => roleText.includes(track.split(" ")[0]))
  if (matchedTrack) {
    return {
      score: 0.12,
      reason: `Identity bridge aligns through ${matchedTrack}`,
    }
  }

  const matchedBridge = identity.bridgePath.find((step) => roleText.includes(step.toLowerCase().split(" ")[0]))
  if (matchedBridge) {
    return {
      score: 0.08,
      reason: `Identity pathway relevance detected via ${matchedBridge}`,
    }
  }

  return {
    score: 0.03,
    reason: `Role remains adjacent to ${identity.origin}`,
  }
}

export function aggregateJobMatches(profile: CareerIdentityProfile): Array<{
  job: NormalizedJob
  trustScore: number
  suitability: ReturnType<typeof scoreApplicationSuitability>
  whyMatched: string[]
  matchedSkills: string[]
  salaryEstimate: string
  probabilityScore: number
  explainability: {
    matchedSkillsCount: number
    requiredSkillsCount: number
    requiredSkills: string[]
    qualificationAligned: boolean
    interviewReadinessPercent: number
  }
}> {
  return STATIC_JOB_POOL.map(normalizeJob)
    .map((job) => {
      const trust = scoreJobTrust(job, profile)
      const suitability = scoreApplicationSuitability(job, profile)
      const identityAlignment = scoreIdentityAlignment(job, profile)
      const roleText = `${job.title} ${job.description}`.toLowerCase()
      const matchedSkills = profile.translatedSkills.filter((skill) => roleText.includes(skill.split(" ")[0]))
      const requiredSkills = getRequiredSkillHints(job)
      const normalizedProfileSkills = profile.translatedSkills.map(normalizeSkillToken)
      const matchedRequiredSkillCount = requiredSkills.filter((required) =>
        normalizedProfileSkills.some((skill) => skill.includes(required) || required.includes(skill)),
      ).length
      const requiredSkillsCount = Math.max(3, requiredSkills.length)
      const qualificationAligned = profile.sourceConfidence >= 0.55 && profile.profileConfidence >= 0.5
      const interviewReadinessPercent = Math.round(suitability.interviewProbability * 100)

      const whyMatched = [
        ...trust.reasons,
        identityAlignment.reason,
        `Profile fit ${(suitability.fit * 100).toFixed(0)}% based on role and readiness alignment`,
      ]

      return {
        job,
        trustScore: trust.trustScore,
        suitability,
        whyMatched,
        matchedSkills,
        salaryEstimate: job.salaryRange || "Not provided",
        probabilityScore: suitability.interviewProbability,
        explainability: {
          matchedSkillsCount: matchedRequiredSkillCount,
          requiredSkillsCount,
          requiredSkills,
          qualificationAligned,
          interviewReadinessPercent: Math.round((interviewReadinessPercent + identityAlignment.score * 100 * 0.5)),
        },
      }
    })
    .sort((a, b) => {
      const aScore = a.suitability.fit + a.trustScore + a.explainability.interviewReadinessPercent / 200
      const bScore = b.suitability.fit + b.trustScore + b.explainability.interviewReadinessPercent / 200
      return bScore - aScore
    })
}
