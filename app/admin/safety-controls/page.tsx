"use client"

import { useEffect, useState } from "react"

type SafetyConfig = {
  disableAdaptiveWorkspace: boolean
  disableOrchestration: boolean
  disableAutonomousPacing: boolean
  forceBalancedMode: boolean
  forceQuietNotifications: boolean
  emergencyRollback: boolean
  safeMode: boolean
  reason: string | null
  updatedAt: string
}

type RolloutPolicy = {
  enabled: boolean
  mode: "percentage" | "cohort" | "internal-only" | "recovery-only"
  percentage: number
  allowedCohorts: string[]
  internalUserIds: string[]
}

const DEFAULT_CONFIG: SafetyConfig = {
  disableAdaptiveWorkspace: false,
  disableOrchestration: false,
  disableAutonomousPacing: false,
  forceBalancedMode: false,
  forceQuietNotifications: false,
  emergencyRollback: false,
  safeMode: false,
  reason: null,
  updatedAt: new Date(0).toISOString(),
}

export default function SafetyControlsPage() {
  const [config, setConfig] = useState<SafetyConfig>(DEFAULT_CONFIG)
  const [rolloutPolicy, setRolloutPolicy] = useState<RolloutPolicy>({
    enabled: true,
    mode: "percentage",
    percentage: 100,
    allowedCohorts: [],
    internalUserIds: [],
  })
  const [personalizationRolloutPolicy, setPersonalizationRolloutPolicy] = useState<RolloutPolicy>({
    enabled: true,
    mode: "percentage",
    percentage: 100,
    allowedCohorts: [],
    internalUserIds: [],
  })
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/admin/safety-controls")
        const data = (await response.json()) as {
          config?: SafetyConfig
          rolloutPolicy?: RolloutPolicy
          personalizationRolloutPolicy?: RolloutPolicy
        }
        if (!cancelled && data.config) {
          setConfig(data.config)
          setReason(data.config.reason ?? "")
          if (data.rolloutPolicy) {
            setRolloutPolicy(data.rolloutPolicy)
          }
          if (data.personalizationRolloutPolicy) {
            setPersonalizationRolloutPolicy(data.personalizationRolloutPolicy)
          }
        }
      } catch (error) {
        console.error("Failed to load safety controls", error)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function persist(next: Partial<SafetyConfig>) {
    setSaving(true)
    try {
      const response = await fetch("/api/admin/safety-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          ...next,
          reason,
          rolloutPolicy,
          personalizationRolloutPolicy,
        }),
      })
      const data = (await response.json()) as {
        config?: SafetyConfig
        rolloutPolicy?: RolloutPolicy
        personalizationRolloutPolicy?: RolloutPolicy
      }
      if (data.config) {
        setConfig(data.config)
      }
      if (data.rolloutPolicy) {
        setRolloutPolicy(data.rolloutPolicy)
      }
      if (data.personalizationRolloutPolicy) {
        setPersonalizationRolloutPolicy(data.personalizationRolloutPolicy)
      }
    } catch (error) {
      console.error("Failed to save safety controls", error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading safety controls...</main>
  }

  const toggles: Array<{ key: keyof SafetyConfig; label: string }> = [
    { key: "safeMode", label: "Safe mode" },
    { key: "emergencyRollback", label: "Emergency rollback" },
    { key: "disableAdaptiveWorkspace", label: "Disable adaptive workspace" },
    { key: "disableOrchestration", label: "Disable orchestration" },
    { key: "disableAutonomousPacing", label: "Disable autonomous pacing" },
    { key: "forceBalancedMode", label: "Force balanced mode" },
    { key: "forceQuietNotifications", label: "Force quiet notifications" },
  ]

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Live Equilibrium Safety Controls</h1>
      <p style={{ marginBottom: 20, color: "#475569" }}>
        Immediate deployment guardrails for adaptive workspace behavior.
      </p>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: "#fff",
        }}
      >
        <p style={{ marginTop: 0, marginBottom: 8 }}>
          Last updated: {new Date(config.updatedAt).toLocaleString()}
        </p>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Operator reason</label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 10 }}
          placeholder="Document why these controls are being changed"
        />
        <button
          onClick={() => persist({ reason })}
          disabled={saving}
          style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: "1px solid #0f172a" }}
        >
          {saving ? "Saving..." : "Save reason"}
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 12,
        }}
      >
        {toggles.map((toggle) => {
          const value = Boolean(config[toggle.key])
          return (
            <label
              key={toggle.key}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fff",
              }}
            >
              <span>{toggle.label}</span>
              <input
                type="checkbox"
                checked={value}
                onChange={async (event) => {
                  const checked = event.target.checked
                  setConfig((prev) => ({ ...prev, [toggle.key]: checked }))
                  await persist({ [toggle.key]: checked } as Partial<SafetyConfig>)
                }}
              />
            </label>
          )
        })}
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Feature Rollout Policy</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={rolloutPolicy.enabled}
            onChange={(event) => setRolloutPolicy((prev) => ({ ...prev, enabled: event.target.checked }))}
          />{" "}
          Enable telemetry feature
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "block" }}>
            Mode
            <select
              value={rolloutPolicy.mode}
              onChange={(event) =>
                setRolloutPolicy((prev) => ({ ...prev, mode: event.target.value as RolloutPolicy["mode"] }))
              }
              style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
            >
              <option value="percentage">Percentage</option>
              <option value="cohort">Cohort</option>
              <option value="internal-only">Internal only</option>
              <option value="recovery-only">Recovery only</option>
            </select>
          </label>
          <label style={{ display: "block" }}>
            Percentage
            <input
              type="number"
              value={rolloutPolicy.percentage}
              min={0}
              max={100}
              onChange={(event) =>
                setRolloutPolicy((prev) => ({ ...prev, percentage: Math.max(0, Math.min(100, Number(event.target.value || 0))) }))
              }
              style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
            />
          </label>
        </div>

        <button
          onClick={() => persist({})}
          disabled={saving}
          style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: "1px solid #0f172a" }}
        >
          {saving ? "Saving..." : "Save rollout policy"}
        </button>
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Personalization Rollout Policy</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={personalizationRolloutPolicy.enabled}
            onChange={(event) =>
              setPersonalizationRolloutPolicy((prev) => ({ ...prev, enabled: event.target.checked }))
            }
          />{" "}
          Enable personalization learning
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "block" }}>
            Mode
            <select
              value={personalizationRolloutPolicy.mode}
              onChange={(event) =>
                setPersonalizationRolloutPolicy((prev) => ({
                  ...prev,
                  mode: event.target.value as RolloutPolicy["mode"],
                }))
              }
              style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
            >
              <option value="percentage">Percentage</option>
              <option value="cohort">Cohort</option>
              <option value="internal-only">Internal only</option>
              <option value="recovery-only">Recovery only</option>
            </select>
          </label>
          <label style={{ display: "block" }}>
            Percentage
            <input
              type="number"
              value={personalizationRolloutPolicy.percentage}
              min={0}
              max={100}
              onChange={(event) =>
                setPersonalizationRolloutPolicy((prev) => ({
                  ...prev,
                  percentage: Math.max(0, Math.min(100, Number(event.target.value || 0))),
                }))
              }
              style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
            />
          </label>
        </div>

        <label style={{ display: "block", marginTop: 10 }}>
          Allowed cohorts (comma-separated)
          <input
            value={personalizationRolloutPolicy.allowedCohorts.join(",")}
            onChange={(event) =>
              setPersonalizationRolloutPolicy((prev) => ({
                ...prev,
                allowedCohorts: event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
            placeholder="pilot,enterprise,beta"
          />
        </label>

        <label style={{ display: "block", marginTop: 10 }}>
          Internal user IDs (comma-separated)
          <input
            value={personalizationRolloutPolicy.internalUserIds.join(",")}
            onChange={(event) =>
              setPersonalizationRolloutPolicy((prev) => ({
                ...prev,
                internalUserIds: event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
            placeholder="user_1,user_2"
          />
        </label>

        <button
          onClick={() => persist({})}
          disabled={saving}
          style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: "1px solid #0f172a" }}
        >
          {saving ? "Saving..." : "Save personalization rollout"}
        </button>
      </section>
    </main>
  )
}
