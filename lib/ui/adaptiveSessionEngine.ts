/**
 * Adaptive Session Shaping Engine
 *
 * Dynamically reshapes workspace layout, visible modules, workflow density, and action complexity
 * based on system equilibrium state and user cognitive capacity.
 *
 * Optimization target: Sustainable long-term human-system equilibrium
 */

import type { SystemPressureState } from "./notificationOrchestrator"

export type SessionWorkspaceMode = "expanded" | "focused" | "recovery" | "continuity"

export type SessionShape = {
  workspaceMode: SessionWorkspaceMode
  visibleModules: string[]
  hiddenModules: string[]
  maxSimultaneousActions: number
  uiDensity: number // 0-1, where 1 is maximum density
  navigationDepth: number // max depth of nested navigation
  recommendedGridColumns: number
  actionComplexityThreshold: number // 0-1, filters UI for complexity
  suggestedFocusModule: string | null
}

/**
 * Maps equilibrium state to workspace shape recommendations
 */
export function getSessionShapeForState(
  pressureState: SystemPressureState,
  userFatigueRisk: number // 0-1
): SessionShape {
  // Core module visibility baseline
  const coreModules = ["dashboard", "continuity", "identity"]

  if (pressureState === "locked") {
    // Identity continuity mode - absolute minimum
    return {
      workspaceMode: "continuity",
      visibleModules: ["continuity", "identity"],
      hiddenModules: ["analytics", "outreach", "pipeline", "opportunities", "recommendations"],
      maxSimultaneousActions: 1,
      uiDensity: 0.2,
      navigationDepth: 1,
      recommendedGridColumns: 1,
      actionComplexityThreshold: 0.1,
      suggestedFocusModule: "continuity",
    }
  }

  if (pressureState === "recovery") {
    // Guided focus - restore equilibrium
    return {
      workspaceMode: "recovery",
      visibleModules: ["continuity", "current_focus", "progress", "identity"],
      hiddenModules: ["analytics", "opportunities", "recommendations", "outreach"],
      maxSimultaneousActions: 2,
      uiDensity: 0.35,
      navigationDepth: 2,
      recommendedGridColumns: 1,
      actionComplexityThreshold: 0.3,
      suggestedFocusModule: "current_focus",
    }
  }

  if (pressureState === "stabilizing") {
    // Simplified focus workspace
    return {
      workspaceMode: "focused",
      visibleModules: ["continuity", "current_focus", "progress", "analytics", "identity"],
      hiddenModules: ["outreach", "recommendations"],
      maxSimultaneousActions: 4,
      uiDensity: 0.5,
      navigationDepth: 3,
      recommendedGridColumns: 2,
      actionComplexityThreshold: 0.5,
      suggestedFocusModule: "current_focus",
    }
  }

  if (pressureState === "accelerated") {
    // Dense layout for high-capacity periods
    return {
      workspaceMode: "expanded",
      visibleModules: [
        "continuity",
        "analytics",
        "opportunities",
        "outreach",
        "pipeline",
        "recommendations",
        "identity",
        "progress",
      ],
      hiddenModules: [],
      maxSimultaneousActions: 8,
      uiDensity: 0.95,
      navigationDepth: 4,
      recommendedGridColumns: 3,
      actionComplexityThreshold: 0.9,
      suggestedFocusModule: null,
    }
  }

  // Default: balanced state
  return {
    workspaceMode: "expanded",
    visibleModules: [
      "continuity",
      "analytics",
      "opportunities",
      "outreach",
      "pipeline",
      "recommendations",
      "identity",
      "progress",
    ],
    hiddenModules: [],
    maxSimultaneousActions: 6,
    uiDensity: 0.7,
    navigationDepth: 3,
    recommendedGridColumns: 2,
    actionComplexityThreshold: 0.7,
    suggestedFocusModule: null,
  }
}

/**
 * Apply fatigue-aware adjustments to session shape
 * Proactively downshift workspace before user perceives overload
 */
export function applyFatigueDownshiftToShape(
  baseShape: SessionShape,
  fatigueRisk: number, // 0-1
): SessionShape {
  if (fatigueRisk < 0.34) {
    // No downshift needed
    return baseShape
  }

  if (fatigueRisk < 0.6) {
    // Mild downshift: reduce density and hidden modules
    return {
      ...baseShape,
      uiDensity: Math.max(0.3, baseShape.uiDensity * 0.8),
      maxSimultaneousActions: Math.max(2, Math.floor(baseShape.maxSimultaneousActions * 0.75)),
      navigationDepth: Math.max(1, baseShape.navigationDepth - 1),
      hiddenModules: [...baseShape.hiddenModules, "recommendations"],
    }
  }

  if (fatigueRisk < 0.78) {
    // Moderate downshift: significant complexity reduction
    return {
      ...baseShape,
      visibleModules: baseShape.visibleModules.filter(
        (m) => !["outreach", "recommendations", "opportunities"].includes(m)
      ),
      uiDensity: Math.max(0.2, baseShape.uiDensity * 0.5),
      maxSimultaneousActions: Math.max(1, Math.floor(baseShape.maxSimultaneousActions * 0.5)),
      navigationDepth: 2,
      actionComplexityThreshold: Math.max(0.2, baseShape.actionComplexityThreshold * 0.6),
    }
  }

  // Severe downshift: minimal guidance
  return {
    ...baseShape,
    workspaceMode: "recovery",
    visibleModules: ["continuity", "progress", "identity"],
    uiDensity: 0.25,
    maxSimultaneousActions: 1,
    navigationDepth: 1,
    actionComplexityThreshold: 0.15,
  }
}

/**
 * Compute effective session shape combining pressure state + fatigue
 */
export function computeEffectiveSessionShape(
  pressureState: SystemPressureState,
  fatigueRisk: number, // 0-1
): SessionShape {
  const baseShape = getSessionShapeForState(pressureState, fatigueRisk)
  return applyFatigueDownshiftToShape(baseShape, fatigueRisk)
}
