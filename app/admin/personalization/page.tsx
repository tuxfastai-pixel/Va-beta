"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type DriftSeverity = "low" | "moderate" | "high" | "critical"

type GovernanceActionKey =
  | "freeze_personalization"
  | "force_balanced_mode"
  | "trigger_recovery_mode"
  | "reduce_adaptation_intensity"
  | "reset_rhythm_learning"
  | "revert_equilibrium_profile"
  | "suppress_proactive_adaptation"
  | "lock_workspace_mode"

type DriftVisuals = {
  trendSparkline: number[]
  driftVelocity: number
  trustDecayIndicator: number
  recoveryFrequencyPerDay: number
  recoveryFrequencyOverlay: number[]
}

type ConfidenceScores = {
  learningConfidence: number
  rhythmStability: number
  recoveryReliability: number
  trustContinuity: number
  identityCoherence: number
}

type DriftEscalation = {
  level: "normal" | "elevated" | "critical" | "emergency"
  severity: number
  factors: string[]
  governanceSeverity: DriftSeverity
  shouldTightenAdaptation: boolean
  recommendRollback: boolean
  recommendedActions: Array<{
    action: string
    rationale: string
    urgency: "low" | "medium" | "high"
  }>
  summary: string
}

type ProfileSummary = {
  userId: string
  identity: {
    fingerprint: string
    pacingStyle: string
    continuityStyle: string
    recoveryStyle: string
    communicationRhythm: string
    workspaceTolerance: string
    adaptationConfidence: number
  }
  trust: {
    trustStability: number
    continuityConfidence: number
    adaptationComfort: number
    regulationAcceptance: number
    trustMomentum: number
  }
  updatedAt: number
  eventSampleSize: number
  driftSeverity: DriftSeverity
  driftVisuals: DriftVisuals
  confidence: ConfidenceScores
  escalation: DriftEscalation
}

type DriftAlert = {
  id: string
  userId: string
  timestamp: number
  delta: number
  summary: string
}

type TimelineEntry = {
  id: string
  timestamp: number
  kind: "drift_event" | "intervention" | "rollback" | "recovery_activation" | "equilibrium_transition"
  userId: string | null
  summary: string
  metadata?: Record<string, unknown>
}

type ProfileDetail = {
  userId: string
  profile: {
    preferredCadenceBand: string
    preferredActionsPerHour: number
    toleranceThresholds: {
      pressure: number
      fatigue: number
      interruptionsPerHour: number
    }
  }
  rhythm: {
    accelerationWindows: number[]
    fatigueWindows: number[]
    disengagementWindows: number[]
    bestRecoveryWindows: number[]
  }
  recovery: {
    reducedNotificationAffinity: number
    reassuranceAffinity: number
    simplificationAffinity: number
    pacingSlowdownAffinity: number
    expectedRecoveryDurationMs: number
    confidence: number
  }
  trust: ProfileSummary["trust"]
  identity: ProfileSummary["identity"]
  eventSampleSize: number
  driftAlerts: DriftAlert[]
  driftSeverity: DriftSeverity
  driftVisuals: DriftVisuals
  confidence: ConfidenceScores
  escalation: DriftEscalation
  governanceSuggestions: string[]
  interventionTimeline: TimelineEntry[]
}

type ActionDescriptor = {
  key: GovernanceActionKey
  label: string
  purpose: string
}

function pct(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function paletteForSeverity(severity: DriftSeverity) {
  if (severity === "critical") {
    return { bg: "#7f1d1d", fg: "#fee2e2", border: "#ef4444" }
  }
  if (severity === "high") {
    return { bg: "#7c2d12", fg: "#ffedd5", border: "#f97316" }
  }
  if (severity === "moderate") {
    return { bg: "#713f12", fg: "#fef9c3", border: "#f59e0b" }
  }
  return { bg: "#14532d", fg: "#dcfce7", border: "#22c55e" }
}

function Sparkline({ values, overlay }: { values: number[]; overlay?: number[] }) {
  if (values.length === 0) {
    return <div style={{ fontSize: 12, color: "#64748b" }}>No trend data</div>
  }

  const width = 180
  const height = 42
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values
    .map((value, index) => {
      const x = index * step
      const y = height - Math.max(0, Math.min(1, value)) * height
      return `${x},${y}`
    })
    .join(" ")

  const overlayBars = (overlay ?? []).map((value, index) => {
    const x = index * step
    const barHeight = Math.max(2, Math.min(1, value) * height)
    return <rect key={`ov-${index}`} x={x - 2} y={height - barHeight} width={4} height={barHeight} fill="#93c5fd" opacity={0.5} />
  })

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {overlayBars}
      <polyline fill="none" stroke="#1d4ed8" strokeWidth="2.2" points={points} />
    </svg>
  )
}

export default function PersonalizationAdminPage() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [alerts, setAlerts] = useState<DriftAlert[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [detail, setDetail] = useState<ProfileDetail | null>(null)
  const [actions, setActions] = useState<ActionDescriptor[]>([])
  const [severityLegend, setSeverityLegend] = useState<Record<DriftSeverity, string>>({
    low: "expected evolution",
    moderate: "accelerated adaptation",
    high: "unstable identity change",
    critical: "continuity integrity risk",
  })
  const [loading, setLoading] = useState(true)
  const [actionStatus, setActionStatus] = useState<{ running: boolean; message: string | null }>({
    running: false,
    message: null,
  })

  const loadSummaries = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    }
    try {
      const response = await fetch("/api/admin/personalization?limit=200&alertsLimit=150&timelineLimit=250")
      const payload = (await response.json()) as {
        profiles?: ProfileSummary[]
        driftAlerts?: DriftAlert[]
        interventionTimeline?: TimelineEntry[]
        governanceSuggestions?: string[]
        availableGovernanceActions?: ActionDescriptor[]
        driftSeverityLegend?: Record<DriftSeverity, string>
      }
      setProfiles(payload.profiles ?? [])
      setAlerts(payload.driftAlerts ?? [])
      setTimeline(payload.interventionTimeline ?? [])
      setSuggestions(payload.governanceSuggestions ?? [])
      setActions(payload.availableGovernanceActions ?? [])
      if (payload.driftSeverityLegend) {
        setSeverityLegend(payload.driftSeverityLegend)
      }
    } catch (error) {
      console.error("Failed to load personalization summaries", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (userId: string) => {
    if (!userId) {
      setDetail(null)
      return
    }

    try {
      const response = await fetch(`/api/admin/personalization?userId=${encodeURIComponent(userId)}&alertsLimit=80&timelineLimit=220`)
      if (!response.ok) {
        setDetail(null)
        return
      }
      const payload = (await response.json()) as ProfileDetail
      setDetail(payload)
    } catch (error) {
      console.error("Failed to load personalization detail", error)
      setDetail(null)
    }
  }, [])

  const applyGovernanceAction = useCallback(
    async (action: GovernanceActionKey, source: string, userId?: string) => {
      setActionStatus({ running: true, message: null })
      try {
        const response = await fetch("/api/admin/personalization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            actor: "personalization-admin",
            userId: userId ?? null,
            source,
            rationale: `Triggered from personalization console (${source})${userId ? ` for ${userId}` : ""}`,
          }),
        })

        if (!response.ok) {
          throw new Error("Governance action failed")
        }

        setActionStatus({ running: false, message: `${action.replaceAll("_", " ")} applied.` })
        await loadSummaries(false)
        if (selectedUserId) {
          await loadDetail(selectedUserId)
        }
      } catch (error) {
        console.error("Failed governance action", error)
        setActionStatus({ running: false, message: "Governance action failed." })
      }
    },
    [loadDetail, loadSummaries, selectedUserId],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void loadSummaries()
    })
    const timer = setInterval(() => {
      void loadSummaries(false)
    }, 20_000)
    return () => clearInterval(timer)
  }, [loadSummaries])

  useEffect(() => {
    queueMicrotask(() => {
      void loadDetail(selectedUserId)
    })
  }, [loadDetail, selectedUserId])

  const topDriftAlerts = useMemo(() => alerts.slice(0, 15), [alerts])
  const topTimeline = useMemo(() => (detail?.interventionTimeline ?? timeline).slice(0, 25), [detail, timeline])
  const activeSuggestions = detail?.governanceSuggestions ?? suggestions

  if (loading) {
    return <main style={{ padding: 24 }}>Loading personalization intelligence...</main>
  }

  return (
    <main style={{ padding: 24, maxWidth: 1220, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Personalized Equilibrium Intelligence</h1>
      <p style={{ color: "#475569" }}>
        Govern adaptive behavior with drift severity, confidence scoring, intervention timeline, and one-click operational controls.
      </p>

      {actionStatus.message && <p style={{ marginTop: 8, color: "#0f766e", fontWeight: 600 }}>{actionStatus.message}</p>}

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Drift Severity Visualization</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {(Object.keys(severityLegend) as DriftSeverity[]).map((severity) => {
            const palette = paletteForSeverity(severity)
            return (
              <article key={severity} style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ display: "inline-block", borderRadius: 999, background: palette.bg, color: palette.fg, padding: "3px 10px", fontSize: 12, textTransform: "uppercase" }}>
                  {severity}
                </div>
                <div style={{ marginTop: 8, color: "#334155" }}>{severityLegend[severity]}</div>
              </article>
            )
          })}
        </div>
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>One-Click Governance Actions</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {actions.map((action) => (
            <button
              key={action.key}
              disabled={actionStatus.running}
              onClick={() => void applyGovernanceAction(action.key, "global-toolbar", selectedUserId || undefined)}
              style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: 10, textAlign: "left", background: "#f8fafc" }}
            >
              <strong>{action.label}</strong>
              <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{action.purpose}</div>
            </button>
          ))}
        </div>
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Identity Drift Alerts</h2>
        {topDriftAlerts.length === 0 ? (
          <p style={{ marginBottom: 0 }}>No identity drift alerts yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {topDriftAlerts.map((alert) => {
              const severity: DriftSeverity =
                alert.delta >= 0.75 ? "critical" : alert.delta >= 0.6 ? "high" : alert.delta >= 0.45 ? "moderate" : "low"
              const palette = paletteForSeverity(severity)
              return (
                <article key={alert.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <strong>{alert.userId}</strong> {alert.summary} ({pct(alert.delta)})
                    </div>
                    <span style={{ background: palette.bg, color: palette.fg, borderRadius: 999, padding: "4px 10px", fontSize: 12, textTransform: "uppercase" }}>
                      {severity}
                    </span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{new Date(alert.timestamp).toLocaleString()}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button
                      disabled={actionStatus.running}
                      onClick={() => {
                        setSelectedUserId(alert.userId)
                        void applyGovernanceAction("revert_equilibrium_profile", "drift-alert", alert.userId)
                      }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #7f1d1d" }}
                    >
                      Rollback identity
                    </button>
                    <button
                      disabled={actionStatus.running}
                      onClick={() => {
                        setSelectedUserId(alert.userId)
                        void applyGovernanceAction("trigger_recovery_mode", "drift-alert", alert.userId)
                      }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #334155" }}
                    >
                      Trigger recovery
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Profile Drill-Down</h2>
        <label style={{ display: "block", marginBottom: 10 }}>
          User ID
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
          >
            <option value="">Select a user</option>
            {profiles.map((profile) => (
              <option key={profile.userId} value={profile.userId}>
                {profile.userId}
              </option>
            ))}
          </select>
        </label>

        {!detail ? (
          <p style={{ marginBottom: 0 }}>Choose a user to inspect full personalization profile.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <strong>Identity:</strong> {detail.identity.fingerprint}
              <div style={{ marginTop: 6, color: "#334155" }}>
                {detail.identity.pacingStyle} | {detail.identity.continuityStyle} | {detail.identity.recoveryStyle}
              </div>
            </article>

            <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <strong>Drift telemetry:</strong>
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "minmax(180px, 220px) 1fr", gap: 10, alignItems: "center" }}>
                <Sparkline values={detail.driftVisuals.trendSparkline} overlay={detail.driftVisuals.recoveryFrequencyOverlay} />
                <div style={{ fontSize: 13, color: "#334155" }}>
                  <div>Drift velocity: {detail.driftVisuals.driftVelocity.toFixed(3)} / hr</div>
                  <div>Trust decay indicator: {pct(detail.driftVisuals.trustDecayIndicator)}</div>
                  <div>Recovery frequency: {detail.driftVisuals.recoveryFrequencyPerDay.toFixed(2)} / day</div>
                </div>
              </div>
            </article>

            <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <strong>Adaptive Confidence Scoring</strong>
              <div style={{ marginTop: 8, display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div>Learning confidence: {pct(detail.confidence.learningConfidence)}</div>
                <div>Rhythm stability: {pct(detail.confidence.rhythmStability)}</div>
                <div>Recovery reliability: {pct(detail.confidence.recoveryReliability)}</div>
                <div>Trust continuity: {pct(detail.confidence.trustContinuity)}</div>
                <div>Identity coherence: {pct(detail.confidence.identityCoherence)}</div>
              </div>
            </article>

            <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <strong>Drift Escalation Workflow</strong>
              <div style={{ marginTop: 6, color: "#334155" }}>{detail.escalation.summary}</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                Governance severity: <strong>{detail.escalation.governanceSeverity}</strong> | Tighten adaptation: {detail.escalation.shouldTightenAdaptation ? "yes" : "no"} | Recommend rollback: {detail.escalation.recommendRollback ? "yes" : "no"}
              </div>
              {detail.escalation.factors.length > 0 && (
                <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                  {detail.escalation.factors.map((factor) => (
                    <div key={factor} style={{ fontSize: 13, color: "#475569" }}>- {factor}</div>
                  ))}
                </div>
              )}
            </article>
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Governance Intervention Timeline</h2>
        {topTimeline.length === 0 ? (
          <p style={{ marginBottom: 0 }}>No intervention timeline entries yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {topTimeline.map((entry) => (
              <article key={entry.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{entry.kind.replaceAll("_", " ")}</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ marginTop: 4 }}>{entry.summary}</div>
                {entry.userId && <div style={{ marginTop: 4, fontSize: 13, color: "#475569" }}>User: {entry.userId}</div>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Autonomous Governance Suggestions</h2>
        {activeSuggestions.length === 0 ? (
          <p style={{ marginBottom: 0 }}>No governance suggestions at the moment.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {activeSuggestions.map((item) => (
              <div key={item} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                {item}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff" }}>
        <h2 style={{ marginTop: 0 }}>All Personalized Profiles</h2>
        {profiles.length === 0 ? (
          <p style={{ marginBottom: 0 }}>No profiles learned yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {profiles.slice(0, 80).map((profile) => {
              const palette = paletteForSeverity(profile.driftSeverity)
              return (
                <article
                  key={profile.userId}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, cursor: "pointer" }}
                  onClick={() => setSelectedUserId(profile.userId)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <strong>{profile.userId}</strong>
                    <span style={{ background: palette.bg, color: palette.fg, borderRadius: 999, padding: "4px 10px", fontSize: 12, textTransform: "uppercase" }}>
                      {profile.driftSeverity}
                    </span>
                  </div>

                  <div style={{ marginTop: 4 }}>{profile.identity.pacingStyle} | {profile.identity.recoveryStyle}</div>

                  <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "190px 1fr", gap: 10, alignItems: "center" }}>
                    <Sparkline values={profile.driftVisuals.trendSparkline} overlay={profile.driftVisuals.recoveryFrequencyOverlay} />
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      velocity {profile.driftVisuals.driftVelocity.toFixed(3)} / hr | trust decay {pct(profile.driftVisuals.trustDecayIndicator)} | recovery {profile.driftVisuals.recoveryFrequencyPerDay.toFixed(2)} / day
                    </div>
                  </div>

                  <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
                    confidence {pct(profile.confidence.learningConfidence)} | rhythm {pct(profile.confidence.rhythmStability)} | trust {pct(profile.confidence.trustContinuity)} | events {profile.eventSampleSize}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
