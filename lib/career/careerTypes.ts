export type CareerPreference = {
  remote: boolean
  hybrid: boolean
  international: boolean
  contract: boolean
  fullTime: boolean
  timezoneFlexibility: "local" | "regional" | "global"
  pacingPreference: "slow" | "balanced" | "fast"
  quietMode: boolean
}

export type CareerQuestionCategory =
  | "background"
  | "education"
  | "experience"
  | "skills"
  | "work-preferences"
  | "international-readiness"

export type CareerQuestion = {
  id: string
  category: CareerQuestionCategory
  prompt: string
  required: boolean
  options?: string[]
}

export type CareerIntakeInput = {
  userId?: string | null
  resumeText?: string | null
  resumeFileName?: string | null
  conversationText?: string | null
  answers?: Record<string, string | boolean | string[] | number | null>
  preferences?: Partial<CareerPreference>
}

export type ParsedResume = {
  sourceType: "txt" | "pdf" | "docx" | "image" | "unknown"
  fileName: string | null
  rawText: string
  lines: string[]
  keywords: string[]
  confidence: number
  warnings: string[]
}

export type NormalizedResume = {
  cleanText: string
  bulletPoints: string[]
  keywordHints: string[]
  skillSignals: string[]
  experienceSignals: string[]
  confidence: number
}

export type CareerIdentityProfile = {
  userId: string | null
  generatedAt: string
  profileConfidence: number
  internationalEmployabilityScore: number
  internationalPaymentReadinessScore: number
  overallReadiness: number
  experienceYearsEstimate?: number
  seniorityTier?: "entry" | "mid" | "senior"
  identityLayer?: {
    origin: string
    bridgePath: string[]
    targetTracks: string[]
    transitionDetected: boolean
  }
  resumeSummary: string
  summary: string
  rawSkills: string[]
  translatedSkills: string[]
  hiddenSkills: string[]
  recommendedRoles: string[]
  workPreferences: CareerPreference
  pacingNotes: string[]
  trustNotes: string[]
  skillConfidence: Record<string, number>
  supportNeeds: string[]
  sourceConfidence: number
}

export type CareerReconstructionOutput = {
  atsCv: string
  remoteReadyCv: string
  shortBio: string
  linkedinSummary: string
  skillsMatrix: Array<{ skill: string; evidence: number; roleFit: number }>
  internationalEmployabilityScore: number
  confidenceProfile: string
}

export type CareerProfileRecord = {
  id: string
  userId: string | null
  createdAt: string
  intake: CareerIntakeInput
  profile: CareerIdentityProfile
  reconstruction: CareerReconstructionOutput
}
