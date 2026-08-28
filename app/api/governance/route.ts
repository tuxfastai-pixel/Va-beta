import { NextRequest, NextResponse } from "next/server";
import { withRateLimit, requireBearerToken } from "@/lib/security/rateLimiter";
import {
  getDecisionAuditTimeline,
  getGovernanceState,
  rollbackOptimization,
  setGovernanceState,
  type AdaptiveModule,
} from "@/lib/intelligence/governance";
import { getGovernanceTelemetry } from "@/lib/intelligence/governanceTelemetry";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(async () => {
  const [state, timeline, telemetry] = await Promise.all([
    getGovernanceState(),
    getDecisionAuditTimeline(200),
    getGovernanceTelemetry(25),
  ]);

  return NextResponse.json({
    success: true,
    asOf: new Date().toISOString(),
    state,
    timeline,
    telemetry,
  });
}, {
  namespace: "api:governance:get",
  limit: 60,
  windowSeconds: 60,
});

export const POST = withRateLimit(async (req: NextRequest) => {
  const auth = requireBearerToken(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({})) as {
    action?: "freeze_module" | "unfreeze_module" | "pause_orchestrator" | "resume_orchestrator" | "force_pricing_reset" | "clear_pricing_reset" | "override_workload" | "clear_workload_override" | "rollback_optimization";
    module?: AdaptiveModule;
    reason?: string;
    actor?: string;
    assignments?: Array<{ workItemId: string; assignedAgent: string; reason?: string }>;
  };

  const actor = body.actor || "governance";
  const reason = body.reason || "manual governance action";

  switch (body.action) {
    case "freeze_module": {
      if (!body.module) return NextResponse.json({ success: false, error: "module required" }, { status: 400 });
      const state = await setGovernanceState({
        frozenModules: { [body.module]: true } as Record<AdaptiveModule, boolean>,
      }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "unfreeze_module": {
      if (!body.module) return NextResponse.json({ success: false, error: "module required" }, { status: 400 });
      const state = await setGovernanceState({
        frozenModules: { [body.module]: false } as Record<AdaptiveModule, boolean>,
      }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "pause_orchestrator": {
      const state = await setGovernanceState({ orchestratorPaused: true }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "resume_orchestrator": {
      const state = await setGovernanceState({ orchestratorPaused: false }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "force_pricing_reset": {
      const state = await setGovernanceState({ forcedPricingReset: true }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "clear_pricing_reset": {
      const state = await setGovernanceState({ forcedPricingReset: false }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "override_workload": {
      const state = await setGovernanceState({
        workloadOverride: {
          enabled: true,
          assignments: body.assignments ?? [],
        },
      }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "clear_workload_override": {
      const state = await setGovernanceState({
        workloadOverride: {
          enabled: false,
          assignments: [],
        },
      }, actor, reason);
      return NextResponse.json({ success: true, state });
    }
    case "rollback_optimization": {
      if (!body.module) return NextResponse.json({ success: false, error: "module required" }, { status: 400 });
      await rollbackOptimization(body.module, reason, actor);
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  }
}, {
  namespace: "api:governance:post",
  limit: 30,
  windowSeconds: 60,
});
