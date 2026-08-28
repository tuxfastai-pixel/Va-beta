import { platforms as platformRegistry } from "@/lib/platforms/platformRegistry";

const platformWeights: Record<string, number> = Object.fromEntries(
  platformRegistry.map((platform) => [platform.name, platform.weight])
);

export function updatePlatformScore(platform: string, success: boolean) {
  const key = String(platform || "").toLowerCase();
  const current = platformWeights[key] ?? 0.5;
  const next = success ? current + 0.1 : current - 0.05;

  platformWeights[key] = Math.max(0.1, Math.min(2, Number(next.toFixed(3))));
  return platformWeights[key];
}

export function getPlatformWeights() {
  return { ...platformWeights };
}

export function updateLearning(job: { weight?: number }, result: "applied" | "interview" | "hired") {
  const nextJob = { ...job, weight: Number(job.weight || 0) };

  if (result === "applied") nextJob.weight += 0.1;
  if (result === "interview") nextJob.weight += 0.5;
  if (result === "hired") nextJob.weight += 1;

  return nextJob;
}

export function shouldAdaptSystem(input: { conversionRate: number; threshold: number }) {
  return input.conversionRate < input.threshold;
}
