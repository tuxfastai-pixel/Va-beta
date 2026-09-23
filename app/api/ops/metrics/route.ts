import { NextRequest, NextResponse } from "next/server";
import { getAgentObservabilitySnapshot } from "@/lib/analytics/agentMetrics";
import { getProfitabilitySnapshot } from "@/lib/analytics/profitMetrics";
import { withRateLimit } from "@/lib/security/rateLimiter";
import { getLatestChaosReport } from "@/lib/testing/chaosTesting";
import { getLatestDecision } from "@/lib/intelligence/decisionMemory";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(async (_req: NextRequest) => {
  const [agentMetrics, profitMetrics, chaosReport, pricingDecision, platformDecision, workloadDecision, reinforcementDecision] = await Promise.all([
    getAgentObservabilitySnapshot(7),
    getProfitabilitySnapshot(30),
    getLatestChaosReport(),
    getLatestDecision("pricing", "global"),
    getLatestDecision("platform", "global"),
    getLatestDecision("workload", "global"),
    getLatestDecision("reinforcement", "global"),
  ]);

  return NextResponse.json({
    success: true,
    asOf: new Date().toISOString(),
    agentKpis: {
      activeAgents: agentMetrics.activeAgents,
      totalActions: agentMetrics.totalActions,
      failures: agentMetrics.failures,
      closeRate: agentMetrics.closeRate,
      averageResponseMs: agentMetrics.averageResponseMs,
      byAgent: agentMetrics.byAgent,
    },
    systemHealth: {
      score: agentMetrics.systemHealth,
      slaBreaches: agentMetrics.slaBreaches,
      resilienceScore: chaosReport?.resilienceScore ?? null,
      highestImpactScenario: chaosReport?.highestImpactScenario ?? null,
      workflowTrace: agentMetrics.workflowTrace,
      eventStream: agentMetrics.eventStream,
    },
    optimizationSafety: {
      pricing: pricingDecision,
      platform: platformDecision,
      workload: workloadDecision,
      reinforcement: reinforcementDecision,
    },
    revenueMetrics: {
      generatedByAgents: agentMetrics.revenueGenerated,
      totalRevenue: profitMetrics.totalRevenue,
      estimatedProfit: profitMetrics.estimatedProfit,
      estimatedMargin: profitMetrics.estimatedMargin,
      recurring: profitMetrics.recurring,
      byPlatform: profitMetrics.byPlatform,
      byNiche: profitMetrics.byNiche,
    },
    pipelineMetrics: {
      dealsInPipeline: agentMetrics.dealsInPipeline,
      failures: agentMetrics.failures,
      slaBreaches: agentMetrics.slaBreaches,
    },
  });
}, {
  namespace: "api:ops:metrics",
  limit: 90,
  windowSeconds: 60,
});
