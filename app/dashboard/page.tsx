"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { stripPlatformCapabilityMarkers } from "@/lib/platforms/profileSync"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const router = useRouter()
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState("")
  const [isRunningAI, setIsRunningAI] = useState(false)
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
  const [skills, setSkills] = useState<Array<{ skill_name?: string; skill?: string; progress: number }>>([])
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

  async function runAI(userIdOverride?: string) {
    const userId = userIdOverride || currentUserId
    if (!userId) {
      return
    }

    setIsRunningAI(true)

    try {
      await fetch("/api/run-orchestrator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      })
    } finally {
      setIsRunningAI(false)
    }
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

      setAiCapabilities(
        Array.isArray(profile?.ai_capabilities)
          ? stripPlatformCapabilityMarkers(
            (profile.ai_capabilities as unknown[]).filter((item): item is string => typeof item === "string")
          )
          : []
      )

      const { data: skillRows } = await supabase
        .from("skill_progress").select("*").eq("user_id", user.id)
      setSkills((skillRows as Array<{ skill_name?: string; skill?: string; progress: number }>) || [])

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

      const [platformRes, progressRes, orchestratorRes] = await Promise.all([
        fetch(`/api/platforms/status?userId=${user.id}`),
        fetch(`/api/progress/score?userId=${user.id}`),
        fetch(`/api/orchestrator/run?userId=${user.id}&autonomous=true&autoApply=false`),
      ])

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

        setKpi({
          applications: Number(kpiPayload.applications || 0),
          replies: Number(kpiPayload.replies || 0),
          conversions: Number(kpiPayload.conversions || 0),
          revenue: Number(kpiPayload.revenue || 0),
          win_rate: Number(kpiPayload.win_rate || 0),
          current_phase: String(kpiPayload.current_phase || "Validation"),
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

    void runAI(currentUserId)
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    const interval = setInterval(() => {
      void runAI(currentUserId)
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

  if (isPageLoading) return <p className="p-8">Loading...</p>

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Career Intelligence Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-white shadow rounded-xl p-6 md:col-span-2">
          <h2 className="font-semibold text-lg mb-3">Ready-to-Earn Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">🔗 Platforms Connected</p>
              <p className="text-2xl font-bold">{platformStats.completedCount}/{platformStats.totalCount}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">🎓 Skill Progress</p>
              <p className="text-2xl font-bold">{skillReadiness}%</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">🤖 AI Capabilities</p>
              <p className="text-2xl font-bold">{aiCapabilities.length > 0 ? "Active" : "Pending"}</p>
            </div>
            <div className="bg-gray-900 text-white rounded-lg p-4">
              <p className="text-sm text-gray-300">💼 Status</p>
              <p className="text-xl font-bold">{readyToEarnLabel}</p>
            </div>
          </div>

          {aiCapabilities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {aiCapabilities.map((capability) => (
                <span key={capability} className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm">
                  {capability}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            <a href="/onboarding" className="text-blue-600 font-medium">Finish onboarding →</a>
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">AI Worker Status</h2>
          <button
            onClick={() => void runAI()}
            className="mb-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!currentUserId || isRunningAI}
          >
            {isRunningAI ? "Running AI..." : "Run AI"}
          </button>
          <div className="space-y-2">
            <p>Worker Name: {workerStatus.worker_name}</p>
            <p>Markets: {(workerStatus.markets || []).join(" / ")}</p>
            <p>Jobs Found Today: {workerStatus.jobs_found_today}</p>
            <p>Applications Sent: {workerStatus.applications_sent}</p>
            <p>Responses: {workerStatus.responses}</p>
            <p>Automation Level: {workerStatus.automation_level}%</p>
            <p>Worker Score: {workerStatus.worker_score}</p>
            <p>Projected Monthly Earnings: ${workerStatus.projected_monthly_earnings}</p>
            <p>Last Run Time: {workerStatus.last_run_time || "Not available"}</p>
            <p>Last Error: {workerStatus.last_error || "None"}</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Projected Monthly Earnings</h2>
          <div className="space-y-2">
            <p>${earnings.usd}</p>
            <p>£{earnings.gbp}</p>
            <p>AED {earnings.aed}</p>
          </div>
          <p className="mt-3 font-medium">Total (USD equivalent): ${earnings.total_usd_equivalent}</p>
          <p className="mt-1 font-medium">Total Earned: ${earnings.total_earned}</p>
          <p className="mt-1 text-sm text-gray-600">AI-generated: ${earnings.ai_generated}</p>
          <p className="mt-1 text-sm text-gray-600">User-generated: ${earnings.user_generated}</p>
          <p className="mt-1 text-sm text-gray-600">Your Cut: ${earnings.your_cut}</p>
          <p className="mt-1 text-sm text-gray-600">Pending: ${earnings.pending}</p>
          <p className="mt-1 text-sm text-gray-600">Withdrawn: ${earnings.withdrawn}</p>
          <p className="mt-1 text-sm text-gray-600">Platform Cut: ${earnings.platform_cut}</p>
          <p className="mt-1 font-medium text-green-700">User Receives: ${earnings.user_receives}</p>
          <p className="mt-1 font-medium">Total Earnings: ${totalEarnings}</p>
          <p className="mt-1 font-medium">Reputation Score: {reputation}</p>
          <p className="mt-1 font-medium">Trust Level: {trustLevel}</p>
          {Object.keys(earnings.by_platform).length > 0 && (
            <div className="mt-3 text-sm text-gray-600 space-y-1">
              {Object.entries(earnings.by_platform).map(([platform, amount]) => (
                <p key={platform}>{platform}: ${Number(amount).toFixed(2)}</p>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">This work was completed using advanced tools to ensure speed and accuracy.</p>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Revenue</h2>
          <p>Total: ${Number(dealsSummary.revenue || 0).toLocaleString()}</p>
          <p>Closed Deals: {dealsSummary.closed_deals}</p>
          <p>Active: {dealsSummary.active_deals}</p>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Daily Conversion KPI</h2>
          <div className="space-y-2 text-sm">
            <p>Applications today: {kpi.applications}</p>
            <p>Replies: {kpi.replies}</p>
            <p>Conversions: {kpi.conversions}</p>
            <p>Revenue: ${kpi.revenue.toFixed(2)}</p>
            <p>Win rate: {kpi.win_rate}%</p>
            <p>Current phase: <span className="font-medium">{kpi.current_phase}</span></p>
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-6 md:col-span-2">
          <h2 className="font-semibold text-lg mb-3">Jobs Most Likely to WIN</h2>
          <p className="text-sm text-gray-500 mb-3">
            State: {orchestratorSnapshot.state || "unknown"} · Action: {orchestratorSnapshot.action || "idle"}
          </p>
          {orchestratorSnapshot.topJobs.length === 0 ? <p>No high-confidence jobs yet.</p> : (
            <div className="space-y-2">
              {orchestratorSnapshot.topJobs.map((job, index) => (
                <div key={`${job.title || "job"}-${index}`} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <span className="font-medium">{job.title || "Untitled job"}</span>
                  <span className="text-blue-600">{job.win_label || "Scored"} · {Number(job.intelligent_score || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Career Goal</h2>
          <p>{careerGoal}</p>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Skill Progress</h2>
          {skills.length === 0 ? <p>No skill progress yet.</p> : (
            <div className="space-y-4">
              {skills.map((item) => (
                <div key={item.skill_name || item.skill || "skill"}>
                  <div className="flex justify-between mb-1">
                    <span>{item.skill_name || item.skill || "Skill"}</span>
                    <span>{item.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Learning Roadmap</h2>
          {roadmap.length === 0 ? <p>No roadmap yet.</p> : (
            <div className="space-y-2">
              {roadmap.slice().sort((a, b) => a.priority - b.priority).map((step) => (
                <div key={`${step.skill}-${step.priority}`}>{step.priority}. {step.skill}</div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Market Trends</h2>
          {trends.length === 0 ? <p>No market trends yet.</p> : (
            <div className="space-y-2">
              {trends.map((trend, i) => <div key={`${trend}-${i}`}>{trend}</div>)}
            </div>
          )}
        </div>

        {clientDashboard && (
          <div className="bg-white shadow rounded-xl p-6 md:col-span-2">
            <h2 className="font-semibold text-lg mb-4">Client Dashboard</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{clientDashboard.activeJobs.length}</p>
                <p className="text-sm text-gray-500 mt-1">Active Jobs</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{clientDashboard.completedJobs.length}</p>
                <p className="text-sm text-gray-500 mt-1">Completed Jobs</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">${clientDashboard.totalEarnings.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">Total Earnings</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-xl p-6 md:col-span-2">
          <h2 className="font-semibold text-lg mb-3">Jobs</h2>
          {opsData.jobs.length === 0 ? <p className="text-gray-400">No jobs yet.</p> : (
            <ul className="divide-y divide-gray-100">
              {opsData.jobs.map((job) => (
                <li key={job.id} className="py-2 flex justify-between text-sm">
                  <span className="font-medium">{job.title}{job.company ? ` — ${job.company}` : ""}</span>
                  <span className="text-gray-500">{job.status}{job.pay_amount ? ` · ${job.currency ?? "USD"} ${job.pay_amount}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white shadow rounded-xl p-6 md:col-span-2">
          <h2 className="font-semibold text-lg mb-3">Invoices</h2>
          {opsData.invoices.length === 0 ? <p className="text-gray-400">No invoices yet.</p> : (
            <ul className="divide-y divide-gray-100">
              {opsData.invoices.map((inv) => (
                <li key={inv.id} className="py-2 flex justify-between text-sm">
                  <span className="font-medium">{inv.description}</span>
                  <span className="text-gray-500">
                    {inv.currency} {inv.amount} &middot;{" "}
                    <span className={inv.status === "paid" ? "text-green-600" : "text-yellow-600"}>{inv.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
