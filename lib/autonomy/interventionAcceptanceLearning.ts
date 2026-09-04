import type { TrustHistoryRecord } from "../trust/trustHistoryStore.ts"

export type InterventionDisposition = "kept" | "undone" | "ignored"

export type InterventionAcceptancePattern = {
  interventionType: string
  total: number
  kept: number
  undone: number
  ignored: number
  stressReductionScore: number
  keptRate: number
  undoRate: number
  ignoreRate: number
}

export type InterventionAcceptanceSummary = {
  userId: string
  acceptanceScore: number
  topAcceptedInterventions: string[]
  topRejectedInterventions: string[]
  patterns: InterventionAcceptancePattern[]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function classifyDisposition(effect: TrustHistoryRecord["interventionEffects"][number]): InterventionDisposition {
  if (effect.accepted && effect.perceivedSupport >= 0.55) {
    return "kept"
  }

  if (!effect.accepted && effect.perceivedSupport <= 0.35) {
    return "undone"
  }

  return "ignored"
}

function inferStressReduction(effect: TrustHistoryRecord["interventionEffects"][number]): number {
  const supportSignal = clamp01((effect.perceivedSupport - 0.5) * 2)
  if (effect.accepted) {
    return clamp01(0.4 + supportSignal * 0.6)
  }
  return clamp01(0.1 + supportSignal * 0.2)
}

export function summarizeInterventionAcceptance(record: TrustHistoryRecord): InterventionAcceptanceSummary {
  const grouped = new Map<
    string,
    {
      kept: number
      undone: number
      ignored: number
      stressReduction: number[]
    }
  >()

  for (const effect of record.interventionEffects.slice(-180)) {
    const key = effect.interventionType || "unknown"
    const existing = grouped.get(key) ?? {
      kept: 0,
      undone: 0,
      ignored: 0,
      stressReduction: [],
    }

    const disposition = classifyDisposition(effect)
    existing[disposition] += 1
    existing.stressReduction.push(inferStressReduction(effect))
    grouped.set(key, existing)
  }

  const patterns: InterventionAcceptancePattern[] = []
  for (const [interventionType, value] of grouped.entries()) {
    const total = value.kept + value.undone + value.ignored
    if (total <= 0) {
      continue
    }

    patterns.push({
      interventionType,
      total,
      kept: value.kept,
      undone: value.undone,
      ignored: value.ignored,
      stressReductionScore: average(value.stressReduction),
      keptRate: value.kept / total,
      undoRate: value.undone / total,
      ignoreRate: value.ignored / total,
    })
  }

  patterns.sort((a, b) => b.total - a.total)

  const acceptanceScore =
    patterns.length > 0
      ? average(patterns.map((pattern) => pattern.keptRate * 0.65 + pattern.stressReductionScore * 0.35))
      : 0.5

  return {
    userId: record.userId,
    acceptanceScore: clamp01(acceptanceScore),
    topAcceptedInterventions: patterns
      .filter((pattern) => pattern.keptRate >= 0.6 && pattern.total >= 2)
      .slice(0, 5)
      .map((pattern) => pattern.interventionType),
    topRejectedInterventions: patterns
      .filter((pattern) => pattern.undoRate >= 0.45 && pattern.total >= 2)
      .slice(0, 5)
      .map((pattern) => pattern.interventionType),
    patterns,
  }
}