/**
 * Alignment Stability Trend Tracker
 * Monitors whether interview alignment is improving or degrading over time
 * Part of Phase 9B governance systems
 */

import type { DriftAnalysis } from "@/lib/governance/interviewDriftEngine";

export interface AlignmentSnapshot {
  timestamp: Date;
  alignmentScore: number;
  riskLevel: DriftAnalysis["riskLevel"];
  terminologyGaps: number;
  confidenceDirectAnswerRate: number;
  workflowMismatchRisk: number;
  realismScore: number;
  recruiterSuspicionLikelihood: number;
}

export interface AlignmentTrend {
  userId: string;
  operationType: string;
  dataPoints: AlignmentSnapshot[];
  trend: "improving" | "degrading" | "stable";
  trendScore: number; // -1 to 1, negative = degrading, positive = improving
  volatility: number; // 0 to 1, how much the scores fluctuate
  averageScore: number;
  bestScore: number;
  worstScore: number;
  projectedScore7days: number;
  stabilityForecast: "stable" | "at_risk" | "unstable";
  recommendations: string[];
  lastUpdated: Date;
}

/**
 * Calculate linear regression trend
 */
function calculateTrendScore(dataPoints: AlignmentSnapshot[]): number {
  if (dataPoints.length < 2) return 0;

  const n = dataPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = dataPoints[i].alignmentScore;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  // Normalize slope to -1 to 1 range
  return Math.max(-1, Math.min(1, slope / 0.5));
}

/**
 * Calculate volatility (standard deviation of scores)
 */
function calculateVolatility(dataPoints: AlignmentSnapshot[]): number {
  if (dataPoints.length < 2) return 0;

  const mean =
    dataPoints.reduce((sum, dp) => sum + dp.alignmentScore, 0) / dataPoints.length;
  const variance =
    dataPoints.reduce((sum, dp) => sum + Math.pow(dp.alignmentScore - mean, 2), 0) /
    dataPoints.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-1 scale
  return Math.min(1, stdDev);
}

/**
 * Project alignment score 7 days ahead based on trend
 */
function projectScore7Days(trend: AlignmentTrend): number {
  if (trend.dataPoints.length === 0) return 0.5;

  const lastScore = trend.dataPoints[trend.dataPoints.length - 1].alignmentScore;
  const daysData = Math.min(7, trend.dataPoints.length);
  const projectionFactor = trend.trendScore * 0.05 * daysData; // 5% change per day per trend unit

  const projected = lastScore + projectionFactor;
  return Math.max(0, Math.min(1, projected));
}

/**
 * Determine stability forecast
 */
function getStabilityForecast(
  trend: number,
  volatility: number,
  averageScore: number
): AlignmentTrend["stabilityForecast"] {
  // High volatility + negative trend = unstable
  if (volatility > 0.3 && trend < -0.3) {
    return "unstable";
  }

  // Degrading trend with low average = at risk
  if (trend < -0.2 && averageScore < 0.6) {
    return "at_risk";
  }

  // Moderate volatility or trending = at risk
  if (volatility > 0.25 || (trend < -0.1 && averageScore < 0.7)) {
    return "at_risk";
  }

  return "stable";
}

/**
 * Generate recommendations based on trend analysis
 */
function generateTrendRecommendations(trend: AlignmentTrend): string[] {
  const recommendations: string[] = [];

  if (trend.trend === "degrading") {
    recommendations.push(
      `⚠️ ALIGNMENT DEGRADING: Score declining ${Math.abs(trend.trendScore * 100).toFixed(0)}% per interview`
    );
    if (trend.averageScore < 0.5) {
      recommendations.push(
        `🔴 CRITICAL: Average alignment below 50%. Pause deployments and revise resume identity.`
      );
    } else {
      recommendations.push(
        `🟡 Increase interview preparation intensity. Review resume-to-interview consistency.`
      );
    }
  }

  if (trend.trend === "improving") {
    recommendations.push(
      `✅ ALIGNMENT IMPROVING: Score increasing ${(trend.trendScore * 100).toFixed(0)}% per interview`
    );
    recommendations.push(`Continue current approach. Maintain momentum.`);
  }

  if (trend.volatility > 0.35) {
    recommendations.push(
      `⚡ HIGH VOLATILITY: Performance inconsistent (${(trend.volatility * 100).toFixed(0)}%). Standardize interview prep approach.`
    );
  }

  if (trend.stabilityForecast === "unstable") {
    recommendations.push(
      `🚨 STABILITY RISK: System approaching instability threshold. Schedule immediate governance review.`
    );
  }

  if (trend.projectedScore7days < 0.4) {
    recommendations.push(
      `📉 7-DAY PROJECTION: Alignment predicted to fall below 40%. Take corrective action now.`
    );
  }

  if (trend.bestScore - trend.worstScore > 0.4) {
    recommendations.push(
      `📊 High variance between best (${(trend.bestScore * 100).toFixed(0)}%) and worst (${(trend.worstScore * 100).toFixed(0)}%) performance. Identify and replicate best practices.`
    );
  }

  return recommendations;
}

/**
 * Create or update alignment trend
 */
export function updateAlignmentTrend(
  userId: string,
  operationType: string,
  driftAnalysis: DriftAnalysis,
  previousTrend?: AlignmentTrend
): AlignmentTrend {
  const newSnapshot: AlignmentSnapshot = {
    timestamp: new Date(),
    alignmentScore: driftAnalysis.alignmentScore,
    riskLevel: driftAnalysis.riskLevel,
    terminologyGaps: driftAnalysis.terminology.mismatchRisk,
    confidenceDirectAnswerRate: driftAnalysis.confidence.directAnswerRate,
    workflowMismatchRisk: driftAnalysis.workflow.mismatchRisk,
    realismScore: driftAnalysis.realism.score,
    recruiterSuspicionLikelihood:
      driftAnalysis.realism.credibilityIndicators.recruiterSuspicionLikelihood,
  };

  const dataPoints = previousTrend
    ? [...previousTrend.dataPoints, newSnapshot]
    : [newSnapshot];

  // Keep only last 30 interviews for trend calculation
  if (dataPoints.length > 30) {
    dataPoints.splice(0, dataPoints.length - 30);
  }

  const trendScore = calculateTrendScore(dataPoints);
  const volatility = calculateVolatility(dataPoints);
  const averageScore = dataPoints.reduce((sum, dp) => sum + dp.alignmentScore, 0) / dataPoints.length;
  const bestScore = Math.max(...dataPoints.map(dp => dp.alignmentScore));
  const worstScore = Math.min(...dataPoints.map(dp => dp.alignmentScore));

  const trend: AlignmentTrend = {
    userId,
    operationType,
    dataPoints,
    trend: trendScore > 0.1 ? "improving" : trendScore < -0.1 ? "degrading" : "stable",
    trendScore,
    volatility,
    averageScore,
    bestScore,
    worstScore,
    projectedScore7days: 0,
    stabilityForecast: "stable",
    recommendations: [],
    lastUpdated: new Date(),
  };

  trend.projectedScore7days = projectScore7Days(trend);
  trend.stabilityForecast = getStabilityForecast(trend.trendScore, trend.volatility, trend.averageScore);
  trend.recommendations = generateTrendRecommendations(trend);

  return trend;
}

/**
 * Export trend data for visualization/reporting
 */
export function exportTrendData(trend: AlignmentTrend) {
  return {
    userId: trend.userId,
    operationType: trend.operationType,
    dataPoints: trend.dataPoints.map(dp => ({
      date: dp.timestamp.toISOString(),
      alignmentScore: Math.round(dp.alignmentScore * 100),
      riskLevel: dp.riskLevel,
      terminologyGaps: Math.round(dp.terminologyGaps * 100),
      confidenceDirectAnswerRate: Math.round(dp.confidenceDirectAnswerRate * 100),
      realismScore: Math.round(dp.realismScore * 100),
      recruiterSuspicionLikelihood: Math.round(dp.recruiterSuspicionLikelihood * 100),
    })),
    summary: {
      trend: trend.trend,
      trendScore: (trend.trendScore * 100).toFixed(1),
      volatility: (trend.volatility * 100).toFixed(1),
      averageScore: (trend.averageScore * 100).toFixed(0),
      bestScore: (trend.bestScore * 100).toFixed(0),
      worstScore: (trend.worstScore * 100).toFixed(0),
      projectedScore7days: (trend.projectedScore7days * 100).toFixed(0),
      stabilityForecast: trend.stabilityForecast,
    },
  };
}

/**
 * Batch update trends for multiple operations
 */
export function updateMultipleTrends(
  userId: string,
  analyses: Array<{ operationType: string; analysis: DriftAnalysis; previousTrend?: AlignmentTrend }>
): AlignmentTrend[] {
  return analyses.map(({ operationType, analysis, previousTrend }) =>
    updateAlignmentTrend(userId, operationType, analysis, previousTrend)
  );
}
