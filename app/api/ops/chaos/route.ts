import { NextRequest, NextResponse } from "next/server";
import { withRateLimit, requireBearerToken } from "@/lib/security/rateLimiter";
import {
  runChaosScenario,
  runChaosSuite,
  runNightlyChaosValidation,
  getLatestChaosReport,
  type ChaosScenario,
} from "@/lib/testing/chaosTesting";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(async (_req: NextRequest) => {
  const report = await runChaosSuite("manual");
  return NextResponse.json({
    success: true,
    mode: "suite",
    resilienceScore: report.resilienceScore,
    highestImpactScenario: report.highestImpactScenario,
    results: report.results,
    generatedAt: report.generatedAt,
  });
}, {
  namespace: "api:ops:chaos:get",
  limit: 10,
  windowSeconds: 60,
});

export const POST = withRateLimit(async (req: NextRequest) => {
  const authError = requireBearerToken(req);
  if (authError) return authError;

  const body = await req.json().catch(() => ({})) as {
    scenario?: ChaosScenario;
    mode?: "single" | "suite" | "nightly" | "latest";
  };
  const scenario = body.scenario;
  const mode = body.mode ?? (scenario ? "single" : "suite");

  if (mode === "latest") {
    const latest = await getLatestChaosReport();
    return NextResponse.json({
      success: true,
      mode: "latest",
      report: latest,
    });
  }

  if (mode === "nightly") {
    const report = await runNightlyChaosValidation();
    return NextResponse.json({
      success: true,
      mode: "nightly",
      resilienceScore: report.resilienceScore,
      highestImpactScenario: report.highestImpactScenario,
      results: report.results,
      generatedAt: report.generatedAt,
    });
  }

  if (!scenario) {
    const report = await runChaosSuite("manual");
    return NextResponse.json({
      success: true,
      mode: "suite",
      resilienceScore: report.resilienceScore,
      highestImpactScenario: report.highestImpactScenario,
      results: report.results,
      generatedAt: report.generatedAt,
    });
  }

  const result = await runChaosScenario(scenario);
  return NextResponse.json({
    success: true,
    mode: "single",
    result,
  });
}, {
  namespace: "api:ops:chaos:post",
  limit: 12,
  windowSeconds: 60,
});
