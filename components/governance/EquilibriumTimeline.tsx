"use client"

import React, { useMemo } from "react"

interface EquilibriumTimelineProps {
  data: Array<{
    timestamp: Date
    pressureState: string
    overallHealth: number // 0-1
    fatigueRisk: number // 0-1
  }>
  hoursBack?: number // default 24
}

/**
 * Equilibrium Timeline Visualization
 *
 * Shows stability, recovery cycles, calm periods, and overload prevention visually.
 * Not technical. Human-readable.
 */
export function EquilibriumTimeline({ data, hoursBack = 24 }: EquilibriumTimelineProps) {
  const segments = useMemo(() => {
    if (data.length < 2) return []

    // Group data into hourly segments
    const now = new Date()
    const segments: Array<[EquilibriumTimelineEntry]> = []

    for (let i = 0; i < hoursBack; i++) {
      const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000)
      const hourEnd = new Date(now.getTime() - i * 60 * 60 * 1000)

      const hourData = data.filter((d) => d.timestamp >= hourStart && d.timestamp < hourEnd)

      if (hourData.length > 0) {
        segments.unshift([
          {
            ...hourData[Math.floor(hourData.length / 2)],
            timestamp: hourStart,
          },
        ])
      }
    }

    return segments.filter((s) => s[0])
  }, [data, hoursBack])

  const getStateColor = (state: string): string => {
    switch (state) {
      case "accelerated":
        return "bg-yellow-600"
      case "balanced":
        return "bg-blue-600"
      case "stabilizing":
        return "bg-purple-600"
      case "recovery":
        return "bg-emerald-600"
      case "locked":
        return "bg-red-700"
      default:
        return "bg-slate-600"
    }
  }

  const getStateLabel = (state: string): string => {
    switch (state) {
      case "accelerated":
        return "Accelerated"
      case "balanced":
        return "Balanced"
      case "stabilizing":
        return "Stabilizing"
      case "recovery":
        return "Recovery"
      case "locked":
        return "Continuity"
      default:
        return "Unknown"
    }
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-100">Equilibrium Timeline</h3>
        <p className="text-sm text-slate-400">Last {hoursBack} hours of system stability</p>
      </div>

      {/* Timeline Visualization */}
      <div className="space-y-3">
        {/* State Timeline */}
        <div>
          <p className="text-xs text-slate-400 mb-2">System State</p>
          <div className="flex gap-1 h-8 rounded-lg overflow-hidden bg-slate-800/50 p-1">
            {segments.map((segment, idx) => {
              const entry = segment[0]
              return (
                <div
                  key={idx}
                  className={`flex-1 ${getStateColor(entry.pressureState)} opacity-80 hover:opacity-100 transition-opacity cursor-pointer rounded-sm group relative`}
                  title={getStateLabel(entry.pressureState)}
                >
                  <div className="absolute bottom-full left-0 mb-2 bg-slate-900 text-slate-100 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    {getStateLabel(entry.pressureState)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Health Timeline */}
        <div>
          <p className="text-xs text-slate-400 mb-2">Overall Health</p>
          <div className="flex gap-1 h-6 rounded-lg overflow-hidden bg-slate-800/50 p-1">
            {segments.map((segment, idx) => {
              const entry = segment[0]
              const healthPercent = entry.overallHealth * 100

              // Color: green (healthy) to red (poor)
              let color = "bg-emerald-600"
              if (healthPercent < 30) color = "bg-red-600"
              else if (healthPercent < 50) color = "bg-orange-600"
              else if (healthPercent < 70) color = "bg-yellow-600"

              return (
                <div
                  key={idx}
                  className={`flex-1 ${color} opacity-70 hover:opacity-100 transition-opacity rounded-sm group relative`}
                  style={{ height: `${Math.max(4, healthPercent)}%` }}
                >
                  <div className="absolute bottom-full left-0 mb-1 bg-slate-900 text-slate-100 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    {Math.round(healthPercent)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Fatigue Timeline */}
        <div>
          <p className="text-xs text-slate-400 mb-2">Fatigue Risk</p>
          <div className="flex gap-1 h-5 rounded-lg overflow-hidden bg-slate-800/50 p-1">
            {segments.map((segment, idx) => {
              const entry = segment[0]
              const fatiguePercent = entry.fatigueRisk * 100

              let color = "bg-emerald-600"
              if (fatiguePercent > 78) color = "bg-red-600"
              else if (fatiguePercent > 60) color = "bg-orange-600"
              else if (fatiguePercent > 34) color = "bg-blue-600"

              return (
                <div
                  key={idx}
                  className={`flex-1 ${color} opacity-60 hover:opacity-100 transition-opacity rounded-sm group relative`}
                  style={{ height: `${Math.max(2, fatiguePercent)}%` }}
                >
                  <div className="absolute bottom-full left-0 mb-1 bg-slate-900 text-slate-100 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    {Math.round(fatiguePercent)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-600 rounded-sm" />
          <span className="text-slate-400">Accelerated</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-600 rounded-sm" />
          <span className="text-slate-400">Balanced</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-600 rounded-sm" />
          <span className="text-slate-400">Stabilizing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-600 rounded-sm" />
          <span className="text-slate-400">Recovery</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-700 rounded-sm" />
          <span className="text-slate-400">Continuity</span>
        </div>
      </div>

      {/* Insight Summary */}
      <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <p className="text-sm text-slate-300">
          {segments.length > 0 ? (
            <>
              Last {hoursBack} hours: System maintained equilibrium through{" "}
              <span className="font-semibold text-emerald-400">
                {Math.round(segments.filter((s) => s[0].overallHealth > 0.6).length / segments.length * 100)}%
              </span>{" "}
              healthy periods. Current trend:{" "}
              <span className="font-semibold">
                {segments[segments.length - 1]?.[0]?.pressureState
                  ? getStateLabel(segments[segments.length - 1][0].pressureState)
                  : "Unknown"}
              </span>
              .
            </>
          ) : (
            "No data yet. Timeline will appear as system runs."
          )}
        </p>
      </div>
    </div>
  )
}
