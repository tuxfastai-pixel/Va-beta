"use client"

import React from "react"
import type { SessionShape } from "@/lib/ui/adaptiveSessionEngine"

interface AdaptiveGridProps {
  shape: SessionShape
  children: React.ReactNode
}

/**
 * Adaptive Grid Component
 * Dynamically reshapes layout based on workspace mode
 */
export function AdaptiveGrid({ shape, children }: AdaptiveGridProps) {
  const getGridClasses = () => {
    switch (shape.workspaceMode) {
      case "expanded":
        return `grid gap-4 ${shape.recommendedGridColumns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"}`
      case "focused":
        return "grid gap-6 grid-cols-1 md:grid-cols-2"
      case "recovery":
        return "grid gap-8 grid-cols-1"
      case "continuity":
        return "grid gap-8 grid-cols-1"
      default:
        return "grid gap-4 grid-cols-1 md:grid-cols-2"
    }
  }

  const getDensityStyles = () => {
    const densityPercent = shape.uiDensity * 100
    return {
      padding: `${Math.max(4, 16 - shape.uiDensity * 12)}px`,
      opacity: Math.max(0.6, 1 - shape.uiDensity * 0.1),
    }
  }

  return (
    <div
      className={`${getGridClasses()} transition-all duration-500 ease-in-out`}
      style={getDensityStyles()}
    >
      {children}
    </div>
  )
}

interface FocusWorkspaceProps {
  focusModule: string | null
  content: Record<string, React.ReactNode>
  shape: SessionShape
}

/**
 * Focus Workspace: Single-focus layout for stabilizing state
 */
export function FocusWorkspace({ focusModule, content, shape }: FocusWorkspaceProps) {
  return (
    <div className="flex flex-col gap-8">
      {focusModule && content[focusModule] && (
        <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 rounded-xl p-8 border border-blue-700/50">
          <div className="max-w-2xl">{content[focusModule]}</div>
        </div>
      )}

      {shape.visibleModules
        .filter((m) => m !== focusModule)
        .map((module) => (
          <div key={module} className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            {content[module]}
          </div>
        ))}
    </div>
  )
}

interface RecoveryWorkspaceProps {
  guidedFocus: string
  continuityAnchor: string
  content: Record<string, React.ReactNode>
  progressFraction: number // 0-1, current progress in recovery
}

/**
 * Recovery Workspace: Minimal, guided layout for recovery state
 */
export function RecoveryWorkspace({
  guidedFocus,
  continuityAnchor,
  content,
  progressFraction,
}: RecoveryWorkspaceProps) {
  return (
    <div className="max-w-lg mx-auto flex flex-col gap-8">
      {/* Continuity Anchor */}
      <div className="bg-slate-900/80 rounded-lg p-6 border-l-4 border-emerald-500">
        <p className="text-sm text-slate-400">Your anchor</p>
        <p className="text-lg font-semibold text-slate-100 mt-1">{continuityAnchor}</p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-800 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>
        <span className="text-sm text-slate-400">{Math.round(progressFraction * 100)}%</span>
      </div>

      {/* Guided Focus */}
      <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 rounded-lg p-6 border border-emerald-700/30">
        <p className="text-sm text-emerald-300 uppercase tracking-wide">Current Focus</p>
        <div className="mt-3">{content[guidedFocus]}</div>
      </div>

      {/* Gentle Encouragement */}
      <div className="text-center text-sm text-slate-300 italic">Take your time. You&apos;re recovering well.</div>
    </div>
  )
}

interface ContinuityWorkspaceProps {
  identityCore: string
  essentialAction: string | null
  content: Record<string, React.ReactNode>
}

/**
 * Continuity Workspace: Minimal, identity-focused layout for locked state
 */
export function ContinuityWorkspace({ identityCore, essentialAction, content }: ContinuityWorkspaceProps) {
  return (
    <div className="max-w-sm mx-auto flex flex-col gap-6">
      {/* Identity Core */}
      <div className="bg-slate-900 rounded-lg p-6 border border-amber-700/50">
        <p className="text-xs text-amber-300/70 uppercase tracking-widest">Identity Continuity</p>
        <p className="text-xl font-semibold text-slate-100 mt-2">{identityCore}</p>
      </div>

      {/* Essential Action (if any) */}
      {essentialAction && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide">One Action</p>
          <p className="text-sm text-slate-200 mt-2">{essentialAction}</p>
        </div>
      )}

      {/* Minimal UI */}
      <div className="text-center text-xs text-slate-500">
        Taking time to preserve what matters.
      </div>
    </div>
  )
}
