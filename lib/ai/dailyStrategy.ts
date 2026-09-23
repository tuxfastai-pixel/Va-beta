import { allocateEffort } from "@/lib/ai/allocationEngine";
import { scoreCareer } from "@/lib/ai/incomeOptimizer";
import { calculateMetrics } from "@/lib/ai/performanceTracker";

type PerformanceRow = {
  career?: string | null;
  applications?: number;
  replies?: number;
  conversions?: number;
  revenue?: number;
};

function normalizeAllocation(allocation: Record<string, number>) {
  const entries = Object.entries(allocation);
  if (entries.length === 0) {
    return allocation;
  }

  for (const [career, value] of entries) {
    if (value < 0.1) {
      allocation[career] = 0.1;
    }

    if (allocation[career] > 0.7) {
      allocation[career] = 0.7;
    }
  }

  const total = Object.values(allocation).reduce((sum, value) => sum + value, 0);

  if (total > 0) {
    for (const key of Object.keys(allocation)) {
      allocation[key] = allocation[key] / total;
    }
  }

  return allocation;
}

export function buildDailyStrategy(performanceData: PerformanceRow[]) {
  const scores: Record<string, number> = {};

  for (const row of performanceData) {
    const career = String(row.career || "").trim();
    if (!career) {
      continue;
    }

    scores[career] = scoreCareer(calculateMetrics(row));
  }

  const allocation = normalizeAllocation(allocateEffort(scores));

  return {
    scores,
    allocation,
  };
}
