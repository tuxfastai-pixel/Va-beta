/**
 * Trust Continuity Scoring
 *
 * Measures long-term consistency and stability:
 * - Follow-through on commitments
 * - Interaction coherence across sessions
 * - Pacing health and rhythm regularity
 * - Identity stability
 * - Equilibrium preservation
 *
 * This becomes one of the most important long-term signals
 */

export type TrustContinuityScore = {
  overallScore: number // 0-1, master trust metric
  followThroughScore: number // 0-1, commitment completion rate
  coherenceScore: number // 0-1, consistency across sessions
  pacingHealthScore: number // 0-1, rhythm regularity
  identityStabilityScore: number // 0-1, how stable is user's identity/direction
  equilibriumPreservationScore: number // 0-1, how well system maintains balance
  trustTrendVector: number // -1 to 1, is trust increasing or decreasing
  lastComputedAt: Date
}

export type TrustContinuityInput = {
  commitmentsStarted: number
  commitmentsCompleted: number
  commitmentsAbandoned: number
  sessionDaysActive: number // days user has been active
  sessionConsistency: number // 0-1, how regular is engagement
  typicalSessionVariance: number // 0-1, how much do session durations vary
  pressureStateStability: number // 0-1, how often does state change
  identityChanges: number // how many times user changed direction/goal
  directionsAbandoned: number // how many goals were abandoned
  recoverySuccessRate: number // 0-1, when in recovery, did user stabilize
  notificationComplianceRate: number // 0-1, does user follow through on suggestions
  consistencyTrendDays: Array<{
    date: Date
    consistencyMetric: number // 0-1
  }>
}

/**
 * Compute comprehensive trust continuity score
 */
export function computeTrustContinuityScore(inputs: TrustContinuityInput): TrustContinuityScore {
  // Follow-through score: completion rate of commitments
  const totalCommitments = inputs.commitmentsStarted
  let followThroughScore = 0
  if (totalCommitments > 0) {
    followThroughScore = inputs.commitmentsCompleted / totalCommitments
  }

  // Coherence score: consistency in patterns
  // High variance in sessions = low coherence
  let coherenceScore = 1 - inputs.typicalSessionVariance
  // Consistency matters too
  coherenceScore *= inputs.sessionConsistency
  // Compliance reinforces coherence
  coherenceScore = coherenceScore * 0.7 + inputs.notificationComplianceRate * 0.3

  // Pacing health: regularized equilibrium state transitions
  // Stable pressure state = healthy pacing
  // Rapid oscillation = poor pacing health
  let pacingHealthScore = 1 - inputs.pressureStateStability
  // Stabilization during recovery is healthy
  pacingHealthScore += inputs.recoverySuccessRate * 0.2
  pacingHealthScore = Math.min(1, pacingHealthScore)

  // Identity stability: how many times did direction change
  let identityStabilityScore = 1
  if (inputs.identityChanges > 0) {
    // Penalize for direction changes, more severe for abandoned goals
    identityStabilityScore -= inputs.identityChanges * 0.1
    identityStabilityScore -= inputs.directionsAbandoned * 0.15
  }
  identityStabilityScore = Math.max(0, identityStabilityScore)

  // Equilibrium preservation: how well did system maintain balance
  // High recovery success = good preservation
  let equilibriumPreservationScore = inputs.recoverySuccessRate
  // More active days = more data for preservation
  const activityFactor = Math.min(1, inputs.sessionDaysActive / 30)
  equilibriumPreservationScore = equilibriumPreservationScore * 0.7 + activityFactor * 0.3

  // Compute trend: is trust increasing or decreasing?
  let trustTrendVector = 0
  if (inputs.consistencyTrendDays.length >= 3) {
    const recentMetrics = inputs.consistencyTrendDays.slice(-7)
    const olderMetrics = inputs.consistencyTrendDays.slice(Math.max(0, recentMetrics.length - 14), recentMetrics.length - 7)

    const recentAvg = recentMetrics.reduce((sum, d) => sum + d.consistencyMetric, 0) / recentMetrics.length
    const olderAvg = olderMetrics.length > 0 ? olderMetrics.reduce((sum, d) => sum + d.consistencyMetric, 0) / olderMetrics.length : recentAvg

    // Trend: -1 (decreasing trust) to 1 (increasing trust)
    trustTrendVector = (recentAvg - olderAvg) / Math.max(0.1, olderAvg)
    trustTrendVector = Math.max(-1, Math.min(1, trustTrendVector))
  }

  // Overall score: weighted combination
  const overallScore =
    followThroughScore * 0.25 + // commitment completion is critical
    coherenceScore * 0.25 + // consistency matters
    pacingHealthScore * 0.2 + // rhythm health
    identityStabilityScore * 0.2 + // direction stability
    equilibriumPreservationScore * 0.1 // system health

  return {
    overallScore: Math.max(0, Math.min(1, overallScore)),
    followThroughScore: Math.max(0, Math.min(1, followThroughScore)),
    coherenceScore: Math.max(0, Math.min(1, coherenceScore)),
    pacingHealthScore: Math.max(0, Math.min(1, pacingHealthScore)),
    identityStabilityScore: Math.max(0, Math.min(1, identityStabilityScore)),
    equilibriumPreservationScore: Math.max(0, Math.min(1, equilibriumPreservationScore)),
    trustTrendVector,
    lastComputedAt: new Date(),
  }
}

/**
 * Interpret trust score for user communication
 */
export function interpretTrustScore(score: TrustContinuityScore): {
  label: string
  interpretation: string
  recommendations: string[]
} {
  if (score.overallScore > 0.8) {
    return {
      label: "Very High Trust",
      interpretation: "Your system knows you well and adapts reliably.",
      recommendations: ["Continue your current rhythm", "System can handle more complexity if desired"],
    }
  }

  if (score.overallScore > 0.6) {
    return {
      label: "Good Trust",
      interpretation: "Solid consistency. System is learning your patterns.",
      recommendations: ["Maintain current workflows", "Be consistent with timing"],
    }
  }

  if (score.overallScore > 0.4) {
    return {
      label: "Building Trust",
      interpretation: "Patterns are forming. System is still learning.",
      recommendations: ["Keep your workflow rhythms regular", "Complete more commitments"],
    }
  }

  if (score.overallScore > 0.2) {
    return {
      label: "Low Trust",
      interpretation: "Inconsistent patterns. System is uncertain how to help.",
      recommendations: ["Establish a regular routine", "Follow through on more actions", "Give system more time to learn"],
    }
  }

  return {
    label: "Very Low Trust",
    interpretation: "System is still learning your patterns.",
    recommendations: ["Be consistent in your actions", "Engage regularly", "Help system understand your preferences"],
  }
}

/**
 * Detect trust disruptions
 */
export function detectTrustDisruption(inputs: TrustContinuityInput): {
  isDisrupted: boolean
  severity: number // 0-1
  factors: string[]
} {
  const factors: string[] = []
  let severity = 0

  // High abandonment rate
  const abandonmentRate =
    inputs.commitmentsStarted > 0 ? inputs.commitmentsAbandoned / inputs.commitmentsStarted : 0
  if (abandonmentRate > 0.3) {
    factors.push(`High abandonment rate (${Math.round(abandonmentRate * 100)}%)`)
    severity += 0.25
  }

  // Rapid direction changes
  if (inputs.identityChanges > 2) {
    factors.push(`Multiple direction changes (${inputs.identityChanges})`)
    severity += 0.2
  }

  // Poor recovery
  if (inputs.recoverySuccessRate < 0.3) {
    factors.push("Difficulty stabilizing when in recovery")
    severity += 0.2
  }

  // Inconsistent session patterns
  if (inputs.typicalSessionVariance > 0.6) {
    factors.push("Highly variable session patterns")
    severity += 0.15
  }

  // Low compliance with system suggestions
  if (inputs.notificationComplianceRate < 0.3) {
    factors.push("Low engagement with system guidance")
    severity += 0.2
  }

  return {
    isDisrupted: severity > 0.3,
    severity: Math.min(1, severity),
    factors,
  }
}
