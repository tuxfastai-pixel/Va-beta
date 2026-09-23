import { writeAuditLog } from "@/lib/audit/auditLog";
import { runReinforcementCycle } from "@/lib/learning/reinforcement";
import { balanceWorkload, type WorkItem } from "@/lib/optimization/workloadBalancer";
import { optimizePlatforms } from "@/lib/optimization/platformOptimizer";
import { optimizePricing } from "@/lib/optimization/pricingOptimizer";
import { forecastCapacity } from "@/lib/prediction/capacityForecast";
import { predictChurn } from "@/lib/prediction/churnPredictor";
import { getRevenueForecast } from "@/lib/prediction/revenueForecast";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  evaluateDecisionGuardrail,
  recordDecision,
  type DecisionGuardrailPolicy,
} from "@/lib/intelligence/decisionMemory";
import { evaluateObjectiveHierarchy } from "@/lib/intelligence/objectiveHierarchy";
import { getGovernanceState } from "@/lib/intelligence/governance";

export interface IntelligenceCycleInput {
  jobs: Array<{ id: string; score?: number; title?: string }>;
}

export interface IntelligenceCycleResult {
  revenueForecast: Awaited<ReturnType<typeof getRevenueForecast>>;
  churnPrediction: Awaited<ReturnType<typeof predictChurn>>;
  capacityForecast: Awaited<ReturnType<typeof forecastCapacity>>;
  pricingAdjustments: Awaited<ReturnType<typeof optimizePricing>>;
  platformOptimization: Awaited<ReturnType<typeof optimizePlatforms>>;
  workloadPlan: Awaited<ReturnType<typeof balanceWorkload>>;
  reinforcement: Awaited<ReturnType<typeof runReinforcementCycle>>;
  adaptiveActionsApplied: boolean;
  guardrailStatus: Record<"pricing" | "platform" | "workload" | "reinforcement", { allowed: boolean; reason: string }>;
}

const DECISION_POLICIES: Record<"pricing" | "platform" | "workload" | "reinforcement", DecisionGuardrailPolicy> = {
  pricing: {
    minConfidence: 0.45,
    minSamples: 20,
    cooldownMinutes: 30,
    maxAdjustmentPct: 5,
  },
  platform: {
    minConfidence: 0.45,
    minSamples: 20,
    cooldownMinutes: 45,
    maxAdjustmentPct: 12,
  },
  workload: {
    minConfidence: 0.5,
    minSamples: 8,
    cooldownMinutes: 15,
    maxAdjustmentPct: 35,
  },
  reinforcement: {
    minConfidence: 0.45,
    minSamples: 20,
    cooldownMinutes: 90,
    maxAdjustmentPct: 8,
  },
};

function buildWorkItemsFromJobs(jobs: IntelligenceCycleInput["jobs"]): WorkItem[] {
  return jobs.slice(0, 30).map((job, index) => {
    const score = Number(job.score || 0);
    const type: WorkItem["type"] = score >= 8 ? "proposal" : score >= 6 ? "lead" : "retention";
    return {
      id: job.id || `job-${index}`,
      type,
      priority: Math.max(1, Math.min(10, Math.round(score || 5))),
      payload: { title: job.title ?? "" },
    };
  });
}

async function adaptiveCooldownActive(minutes = 30): Promise<boolean> {
  const { data } = await supabaseServer
    .from("audit_logs")
    .select("created_at")
    .eq("event_type", "agent_action")
    .eq("entity_type", "system")
    .eq("entity_id", "intelligence_runtime")
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = (data?.[0] as { created_at?: string } | undefined)?.created_at;
  if (!latest) return false;

  const elapsedMs = Date.now() - new Date(latest).getTime();
  return elapsedMs < minutes * 60_000;
}

export async function runIntelligenceCycle(input: IntelligenceCycleInput): Promise<IntelligenceCycleResult> {
  const [revenueForecast, churnPrediction, capacityForecastData, governance] = await Promise.all([
    getRevenueForecast(),
    predictChurn(8),
    forecastCapacity(14),
    getGovernanceState(),
  ]);

  const cooldownActive = await adaptiveCooldownActive(30);
  const confidence = revenueForecast.forecast7Day.confidence;
  const hierarchy = evaluateObjectiveHierarchy({
    systemHealthScore: Math.max(0, 100 - capacityForecastData.overloadRisk),
    slaBreachProbability: capacityForecastData.slaBreachProbability,
    overloadRisk: capacityForecastData.overloadRisk,
    churnHighRiskCount: churnPrediction.filter((row) => row.riskBand === "high").length,
    revenueConfidence: confidence / 100,
  });

  const shouldApplyAdaptiveActions =
    !governance.orchestratorPaused &&
    !cooldownActive &&
    confidence >= 45 &&
    capacityForecastData.slaBreachProbability <= 90 &&
    hierarchy.allowed;

  let pricingAdjustments: Awaited<ReturnType<typeof optimizePricing>> = [];
  let platformOptimization: Awaited<ReturnType<typeof optimizePlatforms>> = {
    generatedAt: new Date().toISOString(),
    allocations: [],
    confidence: 0,
    sampleSize: 0,
  };
  let workloadPlan: Awaited<ReturnType<typeof balanceWorkload>> = [];
  let reinforcement: Awaited<ReturnType<typeof runReinforcementCycle>> = {
    cycleApplied: false,
    cooldownActive: true,
    confidence: 0,
    signalsProcessed: 0,
    updates: [],
    rollbackCount: 0,
    proposalTypeWeights: {},
  };
  let guardrailStatus: IntelligenceCycleResult["guardrailStatus"] = {
    pricing: { allowed: false, reason: "not evaluated" },
    platform: { allowed: false, reason: "not evaluated" },
    workload: { allowed: false, reason: "not evaluated" },
    reinforcement: { allowed: false, reason: "not evaluated" },
  };

  if (shouldApplyAdaptiveActions) {
    const workItems = buildWorkItemsFromJobs(input.jobs);

    const [pricingCandidate, platformCandidate, workloadCandidate, reinforcementCandidate] = await Promise.all([
      optimizePricing(60, {
        maxAdjustmentPct: DECISION_POLICIES.pricing.maxAdjustmentPct,
        minSamples: DECISION_POLICIES.pricing.minSamples,
        minConfidence: DECISION_POLICIES.pricing.minConfidence,
      }),
      optimizePlatforms(30, {
        maxShiftPct: DECISION_POLICIES.platform.maxAdjustmentPct,
        minSamples: DECISION_POLICIES.platform.minSamples,
        minConfidence: DECISION_POLICIES.platform.minConfidence,
      }),
      balanceWorkload(workItems, {
        minConfidence: DECISION_POLICIES.workload.minConfidence * 100,
        maxReassignPct: DECISION_POLICIES.workload.maxAdjustmentPct,
      }),
      runReinforcementCycle({
        cooldownHours: 1.5,
        minConfidence: 0.45,
        maxSignals: 10,
        maxWeightStep: DECISION_POLICIES.reinforcement.maxAdjustmentPct / 100,
        rollbackOnLowConfidence: true,
      }),
    ]);

    const pricingSource = governance.forcedPricingReset
      ? pricingCandidate.map((item) => ({
        ...item,
        recommendedValue: item.currentValue,
        adjustmentPct: 0,
        applied: false,
        reason: "governance forced pricing reset",
      }))
      : pricingCandidate;

    const workloadSource = governance.workloadOverride.enabled && governance.workloadOverride.assignments.length > 0
      ? governance.workloadOverride.assignments.map((item) => ({
        workItemId: item.workItemId,
        assignedAgent: item.assignedAgent as typeof workloadCandidate[number]["assignedAgent"],
        primaryAgent: item.assignedAgent as typeof workloadCandidate[number]["primaryAgent"],
        rebalanced: true,
        confidence: 100,
        reason: item.reason || "governance workload override",
      }))
      : workloadCandidate;

    const pricingAvgAdjustment = pricingSource.length > 0
      ? pricingSource.reduce((sum, row) => sum + Math.abs(Number(row.adjustmentPct || 0)), 0) / pricingSource.length
      : 0;
    const pricingConfidence = pricingSource[0]?.confidence ?? confidence / 100;
    const pricingSamples = pricingSource[0]?.sampleSize ?? pricingSource.length;

    const pricingGuard = await evaluateDecisionGuardrail({
      domain: "pricing",
      decisionKey: "global",
      confidence: pricingConfidence,
      sampleSize: pricingSamples,
      adjustmentPct: pricingAvgAdjustment,
      nextValue: pricingSource,
      policy: DECISION_POLICIES.pricing,
      metadata: { jobsConsidered: input.jobs.length },
    });

    const pricingAllowed = !governance.frozenModules.pricing && pricingGuard.allowed;
    guardrailStatus.pricing = {
      allowed: pricingAllowed,
      reason: governance.frozenModules.pricing
        ? "module frozen by governance"
        : pricingGuard.reason,
    };
    pricingAdjustments = pricingAllowed ? pricingSource : (Array.isArray(pricingGuard.previousValue) ? pricingGuard.previousValue : []);
    await recordDecision({
      domain: "pricing",
      decisionKey: "global",
      status: pricingAllowed ? "applied" : "blocked",
      reason: guardrailStatus.pricing.reason,
      confidence: pricingConfidence,
      sampleSize: pricingSamples,
      adjustmentPct: pricingAvgAdjustment,
      previousValue: pricingGuard.previousValue,
      nextValue: pricingAllowed ? pricingSource : pricingGuard.previousValue,
      metadata: { candidates: pricingSource.length, forcedReset: governance.forcedPricingReset },
    });

    const platformAvgShift = platformCandidate.allocations.length > 0
      ? platformCandidate.allocations.reduce((sum, row) => sum + Math.abs(Number(row.suggestedShiftPct || 0)), 0) / platformCandidate.allocations.length
      : 0;

    const platformGuard = await evaluateDecisionGuardrail({
      domain: "platform",
      decisionKey: "global",
      confidence: platformCandidate.confidence,
      sampleSize: platformCandidate.sampleSize,
      adjustmentPct: platformAvgShift,
      nextValue: platformCandidate,
      policy: DECISION_POLICIES.platform,
    });

    const platformAllowed = !governance.frozenModules.platform && platformGuard.allowed;
    guardrailStatus.platform = {
      allowed: platformAllowed,
      reason: governance.frozenModules.platform ? "module frozen by governance" : platformGuard.reason,
    };
    platformOptimization = platformAllowed
      ? platformCandidate
      : ((platformGuard.previousValue as Awaited<ReturnType<typeof optimizePlatforms>>) ?? {
        generatedAt: new Date().toISOString(),
        allocations: [],
        confidence: 0,
        sampleSize: 0,
      });
    await recordDecision({
      domain: "platform",
      decisionKey: "global",
      status: platformAllowed ? "applied" : "blocked",
      reason: guardrailStatus.platform.reason,
      confidence: platformCandidate.confidence,
      sampleSize: platformCandidate.sampleSize,
      adjustmentPct: platformAvgShift,
      previousValue: platformGuard.previousValue,
      nextValue: platformAllowed ? platformCandidate : platformGuard.previousValue,
      metadata: { allocations: platformCandidate.allocations.length },
    });

    const workloadRebalancePct = workloadCandidate.length > 0
      ? (workloadCandidate.filter((item) => item.rebalanced).length / workloadCandidate.length) * 100
      : 0;
    const workloadConfidence = workloadCandidate.length > 0
      ? workloadCandidate.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / workloadCandidate.length / 100
      : 0;
    const workloadGuard = await evaluateDecisionGuardrail({
      domain: "workload",
      decisionKey: "global",
      confidence: workloadConfidence,
      sampleSize: workloadSource.length,
      adjustmentPct: workloadRebalancePct,
      nextValue: workloadSource,
      policy: DECISION_POLICIES.workload,
    });

    const workloadAllowed = !governance.frozenModules.workload && workloadGuard.allowed;
    guardrailStatus.workload = {
      allowed: workloadAllowed,
      reason: governance.frozenModules.workload ? "module frozen by governance" : workloadGuard.reason,
    };
    workloadPlan = workloadAllowed ? workloadSource : (Array.isArray(workloadGuard.previousValue) ? workloadGuard.previousValue : []);
    await recordDecision({
      domain: "workload",
      decisionKey: "global",
      status: workloadAllowed ? "applied" : "blocked",
      reason: guardrailStatus.workload.reason,
      confidence: workloadConfidence,
      sampleSize: workloadSource.length,
      adjustmentPct: workloadRebalancePct,
      previousValue: workloadGuard.previousValue,
      nextValue: workloadAllowed ? workloadSource : workloadGuard.previousValue,
      metadata: { assignments: workloadSource.length, override: governance.workloadOverride.enabled },
    });

    const reinforcementAdjustment = reinforcementCandidate.updates.length > 0
      ? reinforcementCandidate.updates.reduce(
        (sum, update) => sum + Math.abs(update.delta.scoringWeight) + Math.abs(update.delta.proposalToneWeight) + Math.abs(update.delta.outreachTimingWeight) + Math.abs(update.delta.negotiationToneWeight),
        0,
      ) / reinforcementCandidate.updates.length * 25
      : 0;
    const reinforcementGuard = await evaluateDecisionGuardrail({
      domain: "reinforcement",
      decisionKey: "global",
      confidence: reinforcementCandidate.confidence,
      sampleSize: Math.max(reinforcementCandidate.signalsProcessed, 0),
      adjustmentPct: reinforcementAdjustment,
      nextValue: reinforcementCandidate,
      policy: DECISION_POLICIES.reinforcement,
    });

    const reinforcementAllowed = !governance.frozenModules.reinforcement && reinforcementGuard.allowed;
    guardrailStatus.reinforcement = {
      allowed: reinforcementAllowed,
      reason: governance.frozenModules.reinforcement ? "module frozen by governance" : reinforcementGuard.reason,
    };
    reinforcement = reinforcementAllowed
      ? reinforcementCandidate
      : ((reinforcementGuard.previousValue as Awaited<ReturnType<typeof runReinforcementCycle>>) ?? {
        cycleApplied: false,
        cooldownActive: true,
        confidence: reinforcementCandidate.confidence,
        signalsProcessed: 0,
        updates: [],
        rollbackCount: reinforcementCandidate.rollbackCount,
        proposalTypeWeights: reinforcementCandidate.proposalTypeWeights,
      });
    await recordDecision({
      domain: "reinforcement",
      decisionKey: "global",
      status: reinforcementAllowed ? "applied" : "blocked",
      reason: guardrailStatus.reinforcement.reason,
      confidence: reinforcementCandidate.confidence,
      sampleSize: reinforcementCandidate.signalsProcessed,
      adjustmentPct: reinforcementAdjustment,
      previousValue: reinforcementGuard.previousValue,
      nextValue: reinforcementAllowed ? reinforcementCandidate : reinforcementGuard.previousValue,
      metadata: { rollbacks: reinforcementCandidate.rollbackCount },
    });

    await writeAuditLog({
      event_type: "agent_action",
      entity_type: "system",
      entity_id: "intelligence_runtime",
      actor: "system",
      payload: {
        confidence,
        churnHighRiskClients: churnPrediction.filter((row) => row.riskBand === "high").length,
        slaBreachProbability: capacityForecastData.slaBreachProbability,
        pricingRecommendations: pricingAdjustments.length,
        workloadAssignments: workloadPlan.length,
        reinforcementSignals: reinforcement.signalsProcessed,
        guardrailStatus,
        objectivePriority: hierarchy.activePriority,
        objectiveReasons: hierarchy.reasons,
        governance,
      },
    });
  } else {
    if (governance.orchestratorPaused || !hierarchy.allowed) {
      guardrailStatus = {
        pricing: { allowed: false, reason: governance.orchestratorPaused ? "orchestrator paused by governance" : hierarchy.reasons.join("; ") },
        platform: { allowed: false, reason: governance.orchestratorPaused ? "orchestrator paused by governance" : hierarchy.reasons.join("; ") },
        workload: { allowed: false, reason: governance.orchestratorPaused ? "orchestrator paused by governance" : hierarchy.reasons.join("; ") },
        reinforcement: { allowed: false, reason: governance.orchestratorPaused ? "orchestrator paused by governance" : hierarchy.reasons.join("; ") },
      };
    }
  }

  return {
    revenueForecast,
    churnPrediction,
    capacityForecast: capacityForecastData,
    pricingAdjustments,
    platformOptimization,
    workloadPlan,
    reinforcement,
    adaptiveActionsApplied: shouldApplyAdaptiveActions,
    guardrailStatus,
  };
}
