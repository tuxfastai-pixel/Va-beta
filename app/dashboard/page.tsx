"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { stripPlatformCapabilityMarkers } from "@/lib/platforms/profileSync"
import { useRouter } from "next/navigation"
import { predictFatigue, type FatigueInputs, type FatiguePrediction } from "@/lib/ui/predictiveFatigueModel"
import { computeEquilibriumState, type EquilibriumState } from "@/lib/governance/autonomousEquilibriumController"
import { AdaptiveGrid, ContinuityWorkspace, FocusWorkspace, RecoveryWorkspace } from "@/components/adaptive/AdaptiveWorkspaces"
import type { SystemPressureState } from "@/lib/ui/notificationOrchestrator"
import {
  assessRecoveryPhase,
  estimateRecoveryTime,
  generateContinuitySafeguard,
  generateRecoveryReflections,
  suggestRecoveryAction,
} from "@/lib/ui/recoveryIntelligence"
import {
  computeStabilityScore,
  detectContinuityDisruption,
  extractContinuityPatterns,
} from "@/lib/memory/continuityMemoryEngine"
import { applyDeploymentSafety, DEFAULT_DEPLOYMENT_SAFETY_CONFIG } from "@/lib/governance/deploymentSafety"

type ExperienceActionKey = "refine_profile" | "prepare_interview" | "review_opportunities"

const actionHrefByKey: Record<ExperienceActionKey, string> = {
  refine_profile: "/profile",
  prepare_interview: "/preparation",
  review_opportunities: "/opportunities",
}

type CareerExperiencePayload = {
  confidenceOfGuidance: string;
  stabilityOfDirection: string;
  momentum: string;
  systemGuidanceState: string;
  currentState: {
    title: string;
    message: string;
  };
  nextBestAction: {
    title: string;
    actionLabel: string;
    actionKey: ExperienceActionKey;
  };
  progressSignal: string;
  continuityMessage: string;
  whyThisSuggestion?: string;
  updatedAt: string;
  autoMode: {
    enabled: boolean;
    label: string;
  };
};

type InteractionModeState = {
  prediction: FatiguePrediction;
  inputs: FatigueInputs;
};

type KPIData = {
  applications: number;
  replies: number;
  conversions: number;
  revenue: number;
  win_rate: number;
  current_phase: string;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildDashboardFatigueInputs(kpiData: KPIData): FatigueInputs {
  const totalItems = (kpiData.applications || 0) + (kpiData.replies || 0);
  const conversionRate = totalItems > 0 ? (kpiData.conversions || 0) / totalItems : 0;
  const replyRate = (kpiData.applications || 0) > 0 ? (kpiData.replies || 0) / (kpiData.applications || 1) : 0;

  return {
    ignoredNotificationRate: clamp01(1 - replyRate),
    actionDelayTrend: clamp01(0.3 + (conversionRate > 0.3 ? 0 : 0.4)),
    refinementLoopCount: Math.min(10, (kpiData.applications || 0) / Math.max(1, 5)),
    sessionVolatility: clamp01(Math.abs(conversionRate - 0.2) * 2),
    interruptionSensitivity: clamp01((kpiData.applications || 0) / 50),
    recoveryFrequency: clamp01((kpiData.conversions || 0) / Math.max(1, kpiData.applications || 1)),
  };
}

function interactionModeLabel(mode: FatiguePrediction["recommendedInteractionMode"]): string {
  if (mode === "normal") return "Normal cadence";
  if (mode === "reduced") return "Reduced cadence";
  if (mode === "quiet") return "Quiet mode";
  return "Recovery mode";
}

function deriveDashboardPressureState({
  interactionMode,
  trustLevel,
  focusModeActive,
  winRate,
  skillReadiness,
}: {
  interactionMode: InteractionModeState | null
  trustLevel: string
  focusModeActive: boolean
  winRate: number
  skillReadiness: number
}): SystemPressureState {
  const fatigueRisk = interactionMode?.prediction.fatigueRisk ?? 0.2
  const normalizedTrust = trustLevel.toLowerCase()

  if (fatigueRisk > 0.82 || normalizedTrust === "critical") {
    return "locked"
  }

  if (fatigueRisk > 0.64 || normalizedTrust === "low") {
    return "recovery"
  }

  if (focusModeActive || fatigueRisk > 0.48 || normalizedTrust === "building") {
    return "stabilizing"
  }

  if (winRate > 0.65 && skillReadiness >= 60) {
    return "accelerated"
  }

  return "balanced"
}

function buildTrustContinuityInputs({
  reputation,
  trustLevel,
  careerStats,
  platformStats,
  skillReadiness,
}: {
  reputation: number
  trustLevel: string
  careerStats: Array<{ applications: number; replies: number; conversions: number; revenue: number }>
  platformStats: { completedCount: number; totalCount: number }
  skillReadiness: number
}) {
  const totalApplications = careerStats.reduce((sum, row) => sum + row.applications, 0)
  const totalReplies = careerStats.reduce((sum, row) => sum + row.replies, 0)
  const totalConversions = careerStats.reduce((sum, row) => sum + row.conversions, 0)
  const totalRevenue = careerStats.reduce((sum, row) => sum + row.revenue, 0)
  const sessionDaysActive = Math.max(7, Math.round((platformStats.completedCount || 0) + reputation / 10))
  const sessionConsistency = Math.max(0.1, Math.min(1, skillReadiness / 100))
  const typicalSessionVariance = Math.max(0.1, Math.min(1, 1 - (reputation / 100) * 0.6))
  const pressureStateStability = trustLevel.toLowerCase() === "new" ? 0.4 : 0.7
  const identityChanges = totalConversions > 0 ? Math.max(0, Math.round(totalReplies / Math.max(1, totalConversions)) - 1) : 1
  const directionsAbandoned = totalApplications > 0 ? Math.max(0, Math.round(totalApplications / Math.max(1, totalReplies || 1)) - 1) : 0
  const recoverySuccessRate = Math.max(0.15, Math.min(1, totalRevenue > 0 ? 0.55 + totalRevenue / 10000 : 0.45))
  const notificationComplianceRate = Math.max(0.2, Math.min(1, platformStats.totalCount > 0 ? platformStats.completedCount / platformStats.totalCount : 0.5))

  return {
    commitmentsStarted: Math.max(1, totalApplications || platformStats.totalCount),
    commitmentsCompleted: Math.max(0, totalReplies + totalConversions),
    commitmentsAbandoned: Math.max(0, totalApplications - totalReplies),
    sessionDaysActive,
    sessionConsistency,
    typicalSessionVariance,
    pressureStateStability,
    identityChanges,
    directionsAbandoned,
    recoverySuccessRate,
    notificationComplianceRate,
    consistencyTrendDays: [],
  }
}

function buildCognitiveBudgetInputs({
  kpi,
  platformStats,
  earnings,
  interactionMode,
}: {
  kpi: { applications: number; replies: number; conversions: number; revenue: number }
  platformStats: { completedCount: number; totalCount: number }
  earnings: { total_earned: number; pending: number }
  interactionMode: InteractionModeState | null
}) {
  const fatigueRisk = interactionMode?.prediction.fatigueRisk ?? 0.25

  return {
    decisionCount24h: Math.max(15, kpi.applications * 2 + kpi.replies * 3 + platformStats.completedCount * 5),
    interactionCount1h: Math.max(4, platformStats.completedCount + Math.round(fatigueRisk * 10)),
    contextSwitches1h: Math.max(1, Math.round((kpi.applications + kpi.replies + kpi.conversions) / 8)),
    averageTaskDepth: Math.max(1, Math.min(5, 1.5 + kpi.conversions * 0.4 + earnings.total_earned / 2500)),
    sessionDurationMs: Math.max(20 * 60 * 1000, Math.round((kpi.applications + kpi.replies + 1) * 12 * 60 * 1000)),
    notificationIgnoreRate: interactionMode?.inputs.ignoredNotificationRate ?? 0.2,
    actionsCompleted: Math.max(1, platformStats.completedCount + kpi.conversions),
    actionsAbandoned: Math.max(0, Math.round(kpi.applications * 0.25)),
    userVelocity: Math.max(0.1, Math.min(1, 0.35 + kpi.conversions * 0.08 + earnings.pending / 10000)),
  }
}

function workspaceCardClass(isFocused: boolean): string {
  return isFocused
    ? "rounded-2xl border border-blue-400/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 p-6 shadow-2xl shadow-blue-950/20"
    : "rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-black/20"
}

function pressureStateToLevel(pressureState: SystemPressureState): number {
  if (pressureState === "locked") return 1
  if (pressureState === "recovery") return 0.8
  if (pressureState === "stabilizing") return 0.6
  if (pressureState === "accelerated") return 0.4
  return 0.3
}

async function emitEquilibriumTelemetryEvent(payload: Record<string, unknown>) {
  try {
    await fetch("/api/telemetry/equilibrium-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: payload }),
    })
  } catch (error) {
    console.error("dashboard telemetry emit failed", error)
  }
}

export default function Dashboard() {
  const router = useRouter()
  const lastTelemetrySignatureRef = useRef("")
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState("")
  const [clientDashboard, setClientDashboard] = useState<{
    activeJobs: unknown[];
    completedJobs: unknown[];
    totalEarnings: number;
  } | null>(null)
  const [opsData, setOpsData] = useState<{
    jobs: Array<{ id: string; title: string; status: string; company?: string; pay_amount?: number; currency?: string }>;
    invoices: Array<{ id: string; description: string; amount: number; currency: string; status: string }>;
  }>({ jobs: [], invoices: [] })
  const [careerGoal, setCareerGoal] = useState("Not set")
  const [careerProfile, setCareerProfile] = useState<{
    primary: string;
    secondary: string[];
  }>({ primary: "Not set", secondary: [] })
  const [careerStats, setCareerStats] = useState<Array<{
    career: string;
    applications: number;
    replies: number;
    conversions: number;
    revenue: number;
  }>>([])
  const [roadmap, setRoadmap] = useState<Array<{ skill: string; priority: number }>>([])
  const [trends, setTrends] = useState<string[]>([])
  const [aiCapabilities, setAiCapabilities] = useState<string[]>([])
  const [platformStats, setPlatformStats] = useState({
    completedCount: 0,
    totalCount: 5,
    readyLabel: "SETUP IN PROGRESS",
  })
  const [skillReadiness, setSkillReadiness] = useState(0)
  const [earnings, setEarnings] = useState({
    usd: 0,
    gbp: 0,
    aed: 0,
    total_usd_equivalent: 0,
    total_earned: 0,
    ai_generated: 0,
    user_generated: 0,
    platform_cut: 0,
    your_cut: 0,
    pending: 0,
    withdrawn: 0,
    user_receives: 0,
    by_platform: {} as Record<string, number>,
  })
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [reputation, setReputation] = useState(50)
  const [trustLevel, setTrustLevel] = useState("NEW")
  const [workerStatus, setWorkerStatus] = useState({
    worker_name: "SentleWorker",
    markets: ["US", "UK", "UAE"],
    jobs_found_today: 0,
    applications_sent: 0,
    responses: 0,
    automation_level: 0,
    worker_score: 0,
    projected_monthly_earnings: 0,
    last_run_time: "",
    last_error: "",
  })
  const [dealsSummary, setDealsSummary] = useState({
    revenue: 0,
    closed_deals: 0,
    active_deals: 0,
  })
  const [orchestratorSnapshot, setOrchestratorSnapshot] = useState<{
    state?: string;
    action?: string;
    topJobs: Array<{ title?: string; intelligent_score?: number; win_label?: string }>;
  }>({ topJobs: [] })
  const [kpi, setKpi] = useState({
    applications: 0,
    replies: 0,
    conversions: 0,
    revenue: 0,
    win_rate: 0,
    current_phase: "Validation",
  })
  const [careerExperience, setCareerExperience] = useState<CareerExperiencePayload | null>(null)
  const [interactionMode, setInteractionMode] = useState<InteractionModeState | null>(null)

  async function runAIBackground(userId: string) {
    if (!userId) {
      return
    }

    await fetch("/api/run-orchestrator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    })
  }

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        router.push("/login")
        return
      }

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).maybeSingle()

      setCareerGoal(
        (profile?.career_goal as string | undefined) ||
        (profile?.goal as string | undefined) ||
        "Not set"
      )

      const profileCareers = Array.isArray(profile?.careers)
        ? (profile.careers as unknown[]).filter((item): item is string => typeof item === "string")
        : []

      const primaryCareer = String(profile?.primary_career || "") || profileCareers[0] || "Not set"
      const secondaryCareerList = Array.isArray(profile?.secondary_careers)
        ? (profile.secondary_careers as unknown[]).filter((item): item is string => typeof item === "string")
        : profileCareers.slice(1)

      setCareerProfile({
        primary: primaryCareer,
        secondary: secondaryCareerList,
      })

      setAiCapabilities(
        Array.isArray(profile?.ai_capabilities)
          ? stripPlatformCapabilityMarkers(
            (profile.ai_capabilities as unknown[]).filter((item): item is string => typeof item === "string")
          )
          : []
      )

      const { data: pathRows } = await supabase
        .from("career_paths").select("roadmap, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1)
      const latestRoadmap =
        (pathRows?.[0] as { roadmap?: Array<{ skill: string; priority: number }> } | undefined)?.roadmap || []
      setRoadmap(latestRoadmap)

      const { data: trendMemory } = await supabase
        .from("ai_memory").select("content")
        .eq("user_id", user.id).eq("memory_type", "trend")
        .order("created_at", { ascending: false })
      setTrends((trendMemory || []).map((t: { content: string }) => t.content))

      const { data: careerPerfRows } = await supabase
        .from("career_performance")
        .select("career, applications, replies, conversions, revenue")
        .eq("user_id", user.id)
        .order("last_updated", { ascending: false })

      setCareerStats(
        ((careerPerfRows as Array<{
          career?: string
          applications?: number
          replies?: number
          conversions?: number
          revenue?: number
        }> | null) || []).map((row) => ({
          career: String(row.career || "unknown"),
          applications: Number(row.applications || 0),
          replies: Number(row.replies || 0),
          conversions: Number(row.conversions || 0),
          revenue: Number(row.revenue || 0),
        }))
      )

      const [platformRes, progressRes, orchestratorRes] = await Promise.all([
        fetch(`/api/platforms/status?userId=${user.id}`),
        fetch(`/api/progress/score?userId=${user.id}`),
        fetch(`/api/orchestrator/run?userId=${user.id}&autonomous=true&autoApply=false`),
      ])

      const experienceRes = await fetch(`/api/governance/auto-mode?userId=${user.id}`)
      if (experienceRes.ok) {
        const experiencePayload = await experienceRes.json() as { experience?: CareerExperiencePayload }
        if (experiencePayload.experience) {
          setCareerExperience(experiencePayload.experience)
        }
      }

      if (platformRes.ok) {
        const platformPayload = await platformRes.json() as {
          completedCount?: number;
          totalCount?: number;
          readyLabel?: string;
        }

        setPlatformStats({
          completedCount: Number(platformPayload.completedCount || 0),
          totalCount: Number(platformPayload.totalCount || 5),
          readyLabel: String(platformPayload.readyLabel || "SETUP IN PROGRESS"),
        })
      }

      if (progressRes.ok) {
        const progressPayload = await progressRes.json() as { score?: number }
        setSkillReadiness(Number(progressPayload.score || 0))
      }

      if (orchestratorRes.ok) {
        const orchestratorPayload = await orchestratorRes.json() as {
          results?: Array<{ state?: string; action?: string; result?: { top_jobs?: Array<{ title?: string; intelligent_score?: number; win_label?: string }> } }>
        }
        const firstResult = orchestratorPayload.results?.[0]
        setOrchestratorSnapshot({
          state: firstResult?.state,
          action: firstResult?.action,
          topJobs: firstResult?.result?.top_jobs || [],
        })
      }

      const kpiRes = await fetch(`/api/kpi?userId=${user.id}`)
      if (kpiRes.ok) {
        const kpiPayload = await kpiRes.json() as {
          applications?: number;
          replies?: number;
          conversions?: number;
          revenue?: number;
          win_rate?: number;
          current_phase?: string;
        }

        const newKpi = {
          applications: Number(kpiPayload.applications || 0),
          replies: Number(kpiPayload.replies || 0),
          conversions: Number(kpiPayload.conversions || 0),
          revenue: Number(kpiPayload.revenue || 0),
          win_rate: Number(kpiPayload.win_rate || 0),
          current_phase: String(kpiPayload.current_phase || "Validation"),
        }
        setKpi(newKpi)

        const fatigueInputs = buildDashboardFatigueInputs(newKpi)
        setInteractionMode({
          inputs: fatigueInputs,
          prediction: predictFatigue(fatigueInputs),
        })
      }

      const earningsRes = await fetch("/api/earnings/global")
      if (earningsRes.ok) setEarnings(await earningsRes.json())

      const earningsTotalRes = await fetch(`/api/earnings?user_id=${user.id}`)
      if (earningsTotalRes.ok) {
        const sourceRows = await earningsTotalRes.json()
        const total = Array.isArray(sourceRows)
          ? sourceRows.reduce((sum: number, row: { total?: number }) => sum + Number(row.total || 0), 0)
          : Number(sourceRows?.total || 0)
        setTotalEarnings(total)
      }

      const reputationRes = await fetch(`/api/reputation?user_id=${user.id}`)
      if (reputationRes.ok) {
        const rep = await reputationRes.json()
        setReputation(Number(rep?.score || 50))
        setTrustLevel(String(rep?.trust_level || "new").toUpperCase())
      }

      const workerStatusRes = await fetch(`/api/workers/status?userId=${user.id}`)
      if (workerStatusRes.ok) setWorkerStatus(await workerStatusRes.json())

      const clientId = profile?.client_id as string | undefined
      if (clientId) {
        const clientDashRes = await fetch(`/api/client/dashboard?client_id=${clientId}`)
        if (clientDashRes.ok) setClientDashboard(await clientDashRes.json())
      }

      const opsRes = await fetch("/api/dashboard")
      if (opsRes.ok) setOpsData(await opsRes.json())

      const dealsSummaryRes = await fetch("/api/deals/summary")
      if (dealsSummaryRes.ok) setDealsSummary(await dealsSummaryRes.json())

      setIsPageLoading(false)
    }

    void loadDashboard()
  }, [router])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    void runAIBackground(currentUserId)
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    const interval = setInterval(() => {
      void runAIBackground(currentUserId)
    }, 15 * 60 * 1000)

    return () => clearInterval(interval)
  }, [currentUserId])

  const readyToEarnLabel = useMemo(() => {
    if (platformStats.completedCount >= platformStats.totalCount && skillReadiness >= 60) {
      return "READY TO EARN 🔥"
    }

    if (platformStats.completedCount >= 3 || skillReadiness >= 50) {
      return "ALMOST READY"
    }

    return platformStats.readyLabel
  }, [platformStats, skillReadiness])

  const focusModeActive = useMemo(() => {
    const state = careerExperience?.systemGuidanceState || ""
    return state === "Holding steady for accuracy" || state === "Adapting carefully"
  }, [careerExperience])

  const deploymentSafety = useMemo(
    () =>
      applyDeploymentSafety(
        "balanced",
        {
          ...DEFAULT_DEPLOYMENT_SAFETY_CONFIG,
          disableAdaptiveWorkspace: process.env.NEXT_PUBLIC_DISABLE_ADAPTIVE_WORKSPACE === "true",
          disableOrchestration: process.env.NEXT_PUBLIC_DISABLE_ORCHESTRATION === "true",
          disableAutonomousPacing: process.env.NEXT_PUBLIC_DISABLE_AUTONOMOUS_PACING === "true",
          forceBalancedMode: process.env.NEXT_PUBLIC_FORCE_BALANCED_MODE === "true",
          forceQuietNotifications: process.env.NEXT_PUBLIC_FORCE_QUIET_NOTIFICATIONS === "true",
          safeMode: process.env.NEXT_PUBLIC_EQUILIBRIUM_SAFE_MODE === "true",
          emergencyRollback: process.env.NEXT_PUBLIC_EQUILIBRIUM_EMERGENCY_ROLLBACK === "true",
          updatedAt: new Date(),
          reason: process.env.NEXT_PUBLIC_DEPLOYMENT_SAFETY_REASON ?? null,
        },
      ),
    [],
  )

  const equilibriumState = useMemo<EquilibriumState | null>(() => {
    if (!interactionMode) {
      return null
    }

    const pressureState = deriveDashboardPressureState({
      interactionMode,
      trustLevel,
      focusModeActive,
      winRate: kpi.win_rate,
      skillReadiness,
    })

    const safetyAdjustedPressureState = applyDeploymentSafety(pressureState, {
      ...DEFAULT_DEPLOYMENT_SAFETY_CONFIG,
      disableAdaptiveWorkspace: deploymentSafety.workspaceAdaptiveEnabled === false,
      disableOrchestration: deploymentSafety.orchestrationEnabled === false,
      disableAutonomousPacing: deploymentSafety.autonomousPacingEnabled === false,
      forceBalancedMode: deploymentSafety.effectivePressureState === "balanced" && pressureState !== "balanced",
      forceQuietNotifications: deploymentSafety.notificationMode === "quiet",
      emergencyRollback: deploymentSafety.isEmergencyGuardrailActive,
      safeMode: deploymentSafety.isEmergencyGuardrailActive,
      updatedAt: new Date(),
      reason: deploymentSafety.rationale.join("; "),
    }).effectivePressureState

    return computeEquilibriumState({
      pressureState: safetyAdjustedPressureState,
      fatigueInputs: interactionMode.inputs,
      cognitiveBudgetInputs: buildCognitiveBudgetInputs({
        kpi,
        platformStats,
        earnings,
        interactionMode,
      }),
      trustContinuityInputs: buildTrustContinuityInputs({
        reputation,
        trustLevel,
        careerStats,
        platformStats,
        skillReadiness,
      }),
      sessionDurationMs: Math.max(20 * 60 * 1000, (kpi.applications + kpi.replies + 1) * 10 * 60 * 1000),
      completionRate: Math.max(0.05, Math.min(0.98, kpi.win_rate || (kpi.conversions / Math.max(1, kpi.applications)))),
    })
  }, [careerStats, deploymentSafety, earnings, focusModeActive, interactionMode, kpi, platformStats, reputation, skillReadiness, trustLevel])

  const workspaceShape = !deploymentSafety.workspaceAdaptiveEnabled
    ? {
      workspaceMode: "expanded" as const,
      visibleModules: ["continuity", "identity", "current_focus", "progress", "analytics", "opportunities"],
      hiddenModules: ["recommendations", "outreach"],
      maxSimultaneousActions: 4,
      uiDensity: 0.55,
      navigationDepth: 2,
      recommendedGridColumns: 2,
      actionComplexityThreshold: 0.55,
      suggestedFocusModule: "current_focus",
    }
    : equilibriumState?.sessionShape ?? {
    workspaceMode: "expanded" as const,
    visibleModules: ["continuity", "identity", "current_focus", "progress", "analytics", "opportunities", "recommendations", "outreach"],
    hiddenModules: [],
    maxSimultaneousActions: 6,
    uiDensity: 0.75,
    navigationDepth: 3,
    recommendedGridColumns: 2,
    actionComplexityThreshold: 0.7,
    suggestedFocusModule: null,
  }

  const recoveryIntelligence = useMemo(() => {
    const baseTimestamp = equilibriumState?.timestamp ?? new Date(0)
    const pressureHistory = [
      {
        timestamp: new Date(baseTimestamp.getTime() - 2 * 60 * 60 * 1000),
        state: interactionMode?.prediction.proactiveDownshiftRequired ? "recovery" : "stabilizing",
      },
      {
        timestamp: baseTimestamp,
        state: equilibriumState?.pressureState ?? "balanced",
      },
    ]

    const behaviorHistory = careerStats.flatMap((row) => {
      const totalSteps = Math.max(1, row.applications)
      return Array.from({ length: totalSteps }).map((_, index) => ({
        timestamp: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
        action: `${row.career}_workflow`,
        pressureState: equilibriumState?.pressureState ?? "balanced",
        outcome: index < row.replies ? ("success" as const) : ("neutral" as const),
      }))
    })

    const continuityPatterns = extractContinuityPatterns(behaviorHistory)
    const continuityStability = computeStabilityScore(continuityPatterns)
    const continuityDisruption = detectContinuityDisruption(
      {
        userId: currentUserId || "anonymous",
        patterns: continuityPatterns,
        steadyStateProfile: {
          preferredPacingMode: equilibriumState?.sessionRhythm.pacingMode ?? "balanced",
          typicalSessionLength: equilibriumState?.sessionRhythm.recommendedSessionLength ?? 45 * 60 * 1000,
          mostProductiveTimeOfDay: "day",
          preferredWorkflowType: "guided",
          trustedDirections: [careerGoal],
        },
        trendData: {
          stabilityScore: continuityStability,
          oscillationFrequency: 0.2,
          recoveryPattern: "recovery->stabilizing->balanced",
          riskFactors: [],
        },
        lastUpdateAt: new Date(),
      },
      behaviorHistory.slice(0, 8).map((item) => ({
        action: item.action,
        pressureState: item.pressureState,
        outcome: item.outcome,
      })),
    )

    const phase = assessRecoveryPhase(pressureHistory)
    const reflections = generateRecoveryReflections({
      recentCompletions: behaviorHistory.filter((item) => item.outcome === "success").slice(0, 6).map((item) => item.action),
      recentAbandoned: [],
      pressureState: equilibriumState?.pressureState ?? "balanced",
      fatigueRisk: interactionMode?.prediction.fatigueRisk ?? 0.2,
      trustScore: equilibriumState?.trustContinuity.overallScore ?? 0.5,
      identityStable: continuityStability > 0.45,
    })

    const continuitySafeguard = generateContinuitySafeguard({
      stablePatterns: continuityPatterns.map((pattern) => pattern.description),
      successfulWorkflows: behaviorHistory.filter((item) => item.outcome === "success").map((item) => item.action),
      trustDirection: careerExperience?.systemGuidanceState ?? null,
      identityCore: careerGoal || null,
    })

    return {
      phase,
      reflections,
      continuitySafeguard,
      recoveryTimeMs: estimateRecoveryTime({
        fatigueRisk: interactionMode?.prediction.fatigueRisk ?? 0.2,
        pressureState: equilibriumState?.pressureState ?? "balanced",
        recentOscillations: continuityDisruption.disruptiveFactors.length,
        trustScore: equilibriumState?.trustContinuity.overallScore ?? 0.5,
      }),
      nextAction: suggestRecoveryAction({
        phase,
        fatigueRisk: interactionMode?.prediction.fatigueRisk ?? 0.2,
        completionRate: Math.max(0.05, Math.min(0.95, kpi.win_rate || (kpi.conversions / Math.max(1, kpi.applications)))),
        sessionDurationMs: Math.max(20 * 60 * 1000, (kpi.applications + kpi.replies + 1) * 10 * 60 * 1000),
      }),
      continuityStability,
      continuityDisruption,
    }
  }, [careerExperience, careerGoal, careerStats, currentUserId, equilibriumState, interactionMode, kpi])

  useEffect(() => {
    if (!currentUserId || !equilibriumState || !interactionMode) {
      return
    }

    const signature = [
      equilibriumState.pressureState,
      equilibriumState.sessionShape.workspaceMode,
      interactionMode.prediction.recommendedInteractionMode,
      String(deploymentSafety.isEmergencyGuardrailActive),
      recoveryIntelligence.phase,
    ].join("|")

    if (signature === lastTelemetrySignatureRef.current) {
      return
    }

    const previousState = lastTelemetrySignatureRef.current.split("|")[0] || equilibriumState.pressureState
    const pressureLevel = pressureStateToLevel(equilibriumState.pressureState)
    const fatigueRisk = interactionMode.prediction.fatigueRisk
    const recoveryTriggered = recoveryIntelligence.phase === "acute" || recoveryIntelligence.phase === "stabilizing"

    void emitEquilibriumTelemetryEvent({
      userId: currentUserId,
      eventType: "equilibrium_transition",
      previousState,
      nextState: equilibriumState.pressureState,
      pressureLevel,
      fatigueRisk,
      recoveryTriggered,
      metadata: {
        workspaceMode: equilibriumState.sessionShape.workspaceMode,
        interactionMode: interactionMode.prediction.recommendedInteractionMode,
      },
    })

    if (equilibriumState.sessionShape.workspaceMode === "focused" || equilibriumState.sessionShape.workspaceMode === "recovery") {
      void emitEquilibriumTelemetryEvent({
        userId: currentUserId,
        eventType: "workspace_contraction",
        previousState,
        nextState: equilibriumState.sessionShape.workspaceMode,
        pressureLevel,
        fatigueRisk,
        recoveryTriggered,
      })
    }

    if (recoveryTriggered) {
      void emitEquilibriumTelemetryEvent({
        userId: currentUserId,
        eventType: "recovery_activation",
        previousState,
        nextState: recoveryIntelligence.phase,
        pressureLevel,
        fatigueRisk,
        recoveryTriggered: true,
      })
    }

    void emitEquilibriumTelemetryEvent({
      userId: currentUserId,
      eventType: "continuity_safeguard",
      previousState,
      nextState: equilibriumState.pressureState,
      pressureLevel,
      fatigueRisk,
      recoveryTriggered,
      metadata: {
        engaged: recoveryIntelligence.continuityStability > 0.5,
      },
    })

    if (!deploymentSafety.workspaceAdaptiveEnabled || !deploymentSafety.orchestrationEnabled) {
      void emitEquilibriumTelemetryEvent({
        userId: currentUserId,
        eventType: "orchestration_override",
        previousState,
        nextState: "safety_override",
        pressureLevel,
        fatigueRisk,
        recoveryTriggered,
        metadata: {
          rationale: deploymentSafety.rationale,
        },
      })
    }

    lastTelemetrySignatureRef.current = signature
  }, [currentUserId, deploymentSafety, equilibriumState, interactionMode, recoveryIntelligence])

  const workspaceModules = useMemo(() => {
    const guidanceLabel = careerExperience?.systemGuidanceState || readyToEarnLabel
    const topJob = orchestratorSnapshot.topJobs[0]

    return {
      continuity: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "continuity")}>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80">Continuity</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">{careerGoal}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {careerExperience?.continuityMessage || "The workspace keeps its shape around your long-term direction."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-900/70 p-3">
              <div className="text-slate-400">Trust</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">{trustLevel}</div>
            </div>
            <div className="rounded-xl bg-slate-900/70 p-3">
              <div className="text-slate-400">Guidance</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">{guidanceLabel}</div>
            </div>
          </div>
        </div>
      ),
      identity: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "identity")}>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Identity</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">{careerProfile.primary}</h3>
          <p className="mt-3 text-sm text-slate-300">{careerGoal}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            {careerProfile.secondary.slice(0, 4).map((item) => (
              <span key={item} className="rounded-full border border-slate-700 px-3 py-1">{item}</span>
            ))}
          </div>
        </div>
      ),
      current_focus: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "current_focus")}>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Current Focus</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">
            {careerExperience?.nextBestAction.title || topJob?.title || "Choose one concrete next move"}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {careerExperience?.progressSignal || careerExperience?.whyThisSuggestion || "The system is narrowing the workspace to keep pressure manageable."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={careerExperience ? actionHrefByKey[careerExperience.nextBestAction.actionKey] || "/dashboard" : "/dashboard"}
              className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              {careerExperience?.nextBestAction.actionLabel || "Continue"}
            </a>
            <span className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300">
              Max actions: {workspaceShape.maxSimultaneousActions}
            </span>
          </div>
        </div>
      ),
      progress: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "progress")}>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Progress</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">Momentum snapshot</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-900/70 p-3"><div className="text-slate-400">Applications</div><div className="mt-1 text-lg font-semibold text-slate-100">{kpi.applications}</div></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><div className="text-slate-400">Replies</div><div className="mt-1 text-lg font-semibold text-slate-100">{kpi.replies}</div></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><div className="text-slate-400">Conversions</div><div className="mt-1 text-lg font-semibold text-slate-100">{kpi.conversions}</div></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><div className="text-slate-400">Win rate</div><div className="mt-1 text-lg font-semibold text-slate-100">{Math.round(kpi.win_rate * 100)}%</div></div>
          </div>
        </div>
      ),
      analytics: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "analytics")}>
          <p className="text-xs uppercase tracking-[0.3em] text-violet-300/80">Analytics</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">Career performance</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>Reputation score: {reputation}</p>
            <p>Skill readiness: {skillReadiness}</p>
            <p>Earnings: {totalEarnings.toLocaleString()}</p>
          </div>
          <div className="mt-4 space-y-2">
            {careerStats.slice(0, 3).map((row) => (
              <div key={row.career} className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300">
                <div className="font-medium text-slate-100">{row.career}</div>
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>{row.applications} apps</span>
                  <span>{row.replies} replies</span>
                  <span>{row.conversions} conv</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      opportunities: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "opportunities")}>
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300/80">Opportunities</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">Active pipeline</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>Active jobs: {opsData.jobs.length}</p>
            <p>Open deals: {dealsSummary.active_deals}</p>
            <p>Top orchestrator signal: {topJob?.win_label || topJob?.title || "None yet"}</p>
          </div>
        </div>
      ),
      recommendations: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "recommendations")}>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80">Recommendations</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">Guidance signals</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>{trends[0] || "The system is learning from repeat patterns and recent pace."}</p>
            <p>{roadmap[0] ? `Next roadmap priority: ${roadmap[0].skill}` : "Roadmap will tighten as the session stabilizes."}</p>
            <p>{platformStats.readyLabel}</p>
          </div>
        </div>
      ),
      outreach: (
        <div className={workspaceCardClass(workspaceShape.suggestedFocusModule === "outreach")}>
          <p className="text-xs uppercase tracking-[0.3em] text-rose-300/80">Outreach</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">Delivery state</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>Worker score: {workerStatus.worker_score}</p>
            <p>Responses: {workerStatus.responses}</p>
            <p>Last run: {workerStatus.last_run_time || "Not yet run"}</p>
          </div>
        </div>
      ),
    }
  }, [
    careerExperience,
    careerGoal,
    careerProfile.primary,
    careerProfile.secondary,
    careerStats,
    dealsSummary.active_deals,
    kpi.applications,
    kpi.conversions,
    kpi.replies,
    kpi.win_rate,
    opsData.jobs.length,
    orchestratorSnapshot.topJobs,
    platformStats.readyLabel,
    reputation,
    roadmap,
    skillReadiness,
    readyToEarnLabel,
    totalEarnings,
    trustLevel,
    trends,
    workerStatus.last_run_time,
    workerStatus.responses,
    workerStatus.worker_score,
    workspaceShape.maxSimultaneousActions,
    workspaceShape.suggestedFocusModule,
  ])

  const workspaceTitle = equilibriumState?.sessionShape.workspaceMode || "expanded"

  if (isPageLoading) return <p className="p-8">Loading...</p>

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.98),_rgba(2,6,23,1))] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-sky-300/80">Adaptive Session Architecture</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50">Career Intelligence Dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                The workspace now reshapes itself around fatigue, trust, and continuity. Layout density, focus breadth, and action pressure all shift with the current equilibrium state.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-slate-400">Mode</div>
                <div className="mt-1 text-lg font-semibold capitalize text-slate-50">{workspaceTitle}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-slate-400">Health</div>
                <div className="mt-1 text-lg font-semibold text-slate-50">{equilibriumState ? `${Math.round(equilibriumState.overallHealth * 100)}%` : "--"}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-slate-400">Fatigue</div>
                <div className="mt-1 text-lg font-semibold text-slate-50">{interactionMode ? `${Math.round(interactionMode.prediction.fatigueRisk * 100)}%` : "--"}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-slate-400">Columns</div>
                <div className="mt-1 text-lg font-semibold text-slate-50">{workspaceShape.recommendedGridColumns}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-blue-950/30 to-slate-950 p-6 shadow-xl shadow-blue-950/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-300">Predictive Cadence</p>
              <h2 className="mt-2 mb-3 text-2xl font-bold">
                {interactionMode ? interactionModeLabel(interactionMode.prediction.recommendedInteractionMode) : "Normal cadence"}
              </h2>
              <p className="max-w-2xl leading-relaxed text-sm text-slate-300">
                Guidance rhythm adapts before cognitive overload emerges. Your dashboard communication becomes calmer as fatigue risk rises.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-900/70 p-3">
                <div className="text-xs text-slate-400">Ignore Rate</div>
                <div className="text-lg font-semibold text-slate-200">{interactionMode ? `${Math.round(interactionMode.inputs.ignoredNotificationRate * 100)}%` : "--"}</div>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <div className="text-xs text-slate-400">Mode</div>
                <div className="text-lg font-semibold capitalize text-slate-200">{interactionMode?.prediction.recommendedInteractionMode || "--"}</div>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <div className="text-xs text-slate-400">Applications</div>
                <div className="text-lg font-semibold text-slate-200">{kpi.applications}</div>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <div className="text-xs text-slate-400">Overload</div>
                <div className="text-lg font-semibold text-slate-200">{interactionMode ? `${interactionMode.prediction.predictedOverloadWindow}h` : "--"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-emerald-800/40 bg-gradient-to-r from-emerald-950/30 via-slate-950 to-cyan-950/30 p-6 shadow-xl shadow-emerald-950/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Recovery Intelligence</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                {recoveryIntelligence.phase === "acute" ? "Stabilizing now" : "Continuity is strengthening"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {recoveryIntelligence.continuitySafeguard}
              </p>
              <p className="mt-3 text-sm text-slate-200">
                {recoveryIntelligence.continuityStability > 0.65
                  ? "You’ve maintained strong consistency."
                  : recoveryIntelligence.continuityStability > 0.45
                    ? "Progress remains steady."
                    : "Your direction is becoming clearer."}
              </p>
              {recoveryIntelligence.nextAction && (
                <p className="mt-2 text-sm text-cyan-200">Next: {recoveryIntelligence.nextAction}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm lg:max-w-sm">
              {recoveryIntelligence.reflections.map((reflection) => (
                <div key={reflection.title} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{reflection.summaryType}</p>
                  <p className="mt-1 font-medium text-slate-100">{reflection.title}</p>
                  <p className="mt-1 text-slate-300">{reflection.message}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-xl bg-slate-900/60 p-3">
              <p className="text-slate-400">Estimated recovery window</p>
              <p className="mt-1 font-semibold text-slate-100">{Math.round(recoveryIntelligence.recoveryTimeMs / (60 * 1000))} minutes</p>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-3">
              <p className="text-slate-400">Continuity stability</p>
              <p className="mt-1 font-semibold text-slate-100">{Math.round(recoveryIntelligence.continuityStability * 100)}%</p>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-3">
              <p className="text-slate-400">Disruption factors</p>
              <p className="mt-1 font-semibold text-slate-100">{recoveryIntelligence.continuityDisruption.disruptiveFactors.length}</p>
            </div>
          </div>
          {deploymentSafety.rationale.length > 0 && (
            <p className="mt-4 text-xs text-amber-300">Deployment safety active: {deploymentSafety.rationale.join(" | ")}</p>
          )}
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/40 p-4 shadow-xl shadow-black/20 backdrop-blur">
          {equilibriumState?.sessionShape.workspaceMode === "continuity" ? (
            <ContinuityWorkspace
              identityCore={careerGoal}
              essentialAction={careerExperience?.nextBestAction.actionLabel || "Hold the line and complete one safe step."}
              content={workspaceModules}
            />
          ) : equilibriumState?.sessionShape.workspaceMode === "recovery" ? (
            <RecoveryWorkspace
              guidedFocus={equilibriumState.sessionShape.suggestedFocusModule || "current_focus"}
              continuityAnchor={careerExperience?.continuityMessage || careerGoal}
              content={workspaceModules}
              progressFraction={Math.max(0.08, Math.min(0.92, equilibriumState.overallHealth))}
            />
          ) : equilibriumState?.sessionShape.workspaceMode === "focused" ? (
            <FocusWorkspace
              focusModule={equilibriumState.sessionShape.suggestedFocusModule}
              content={workspaceModules}
              shape={equilibriumState.sessionShape}
            />
          ) : (
            <AdaptiveGrid shape={workspaceShape}>
              {workspaceShape.visibleModules.map((module) => (
                <div key={module}>{workspaceModules[module as keyof typeof workspaceModules]}</div>
              ))}
            </AdaptiveGrid>
          )}
        </section>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-lg font-semibold text-slate-50">Operational Footprint</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div className="rounded-xl bg-slate-900/70 p-3">
                <p className="text-slate-400">Client dashboard</p>
                <p className="mt-1 font-medium text-slate-100">{clientDashboard ? `${clientDashboard.activeJobs.length} active / ${clientDashboard.completedJobs.length} completed` : "Unavailable"}</p>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <p className="text-slate-400">Ops jobs</p>
                <p className="mt-1 font-medium text-slate-100">{opsData.jobs.length}</p>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <p className="text-slate-400">Invoices</p>
                <p className="mt-1 font-medium text-slate-100">{opsData.invoices.length}</p>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <p className="text-slate-400">Deals closed</p>
                <p className="mt-1 font-medium text-slate-100">{dealsSummary.closed_deals}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-lg font-semibold text-slate-50">Trust & Reputation</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p><span className="text-slate-400">Trust level:</span> {trustLevel}</p>
              <p><span className="text-slate-400">Reputation:</span> {reputation}</p>
              <p><span className="text-slate-400">Orchestrator:</span> {orchestratorSnapshot.state || "Idle"}</p>
              <p><span className="text-slate-400">Focus mode:</span> {focusModeActive ? "Active" : "Off"}</p>
              <p><span className="text-slate-400">Current phase:</span> {kpi.current_phase}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-lg font-semibold text-slate-50">Readiness</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>{readyToEarnLabel}</p>
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2">
                <span className="text-slate-400">Completed</span>
                <span className="font-medium text-slate-100">{platformStats.completedCount}/{platformStats.totalCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2">
                <span className="text-slate-400">Skill readiness</span>
                <span className="font-medium text-slate-100">{skillReadiness}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {aiCapabilities.slice(0, 4).map((capability) => (
                  <span key={capability} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">{capability}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 md:col-span-2 xl:col-span-3">
            <h2 className="text-lg font-semibold text-slate-50">Financial Snapshot</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 text-sm text-slate-300">
              <div className="rounded-xl bg-slate-900/70 p-3"><p className="text-slate-400">USD</p><p className="mt-1 font-medium text-slate-100">${earnings.usd.toFixed(2)}</p></div>
              <div className="rounded-xl bg-slate-900/70 p-3"><p className="text-slate-400">Total</p><p className="mt-1 font-medium text-slate-100">${earnings.total_earned.toFixed(2)}</p></div>
              <div className="rounded-xl bg-slate-900/70 p-3"><p className="text-slate-400">Your cut</p><p className="mt-1 font-medium text-slate-100">${earnings.user_receives.toFixed(2)}</p></div>
              <div className="rounded-xl bg-slate-900/70 p-3"><p className="text-slate-400">Pending</p><p className="mt-1 font-medium text-slate-100">${earnings.pending.toFixed(2)}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
