import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/security/rateLimiter";
import { optimizePricing } from "@/lib/optimization/pricingOptimizer";
import { optimizePlatforms } from "@/lib/optimization/platformOptimizer";
import { balanceWorkload, type WorkItem } from "@/lib/optimization/workloadBalancer";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function buildOptimizationWorkItems(): Promise<WorkItem[]> {
  const [{ data: deals }, { data: overdueInvoices }] = await Promise.all([
    supabaseServer
      .from("deals")
      .select("id, stage, probability")
      .in("stage", ["lead", "contacted", "interview", "negotiation"])
      .order("updated_at", { ascending: false })
      .limit(80),
    supabaseServer
      .from("invoices")
      .select("id")
      .eq("status", "overdue")
      .limit(80),
  ]);

  const dealItems: WorkItem[] = (deals ?? []).map((deal) => ({
    id: String((deal as { id?: string }).id || crypto.randomUUID()),
    type: "proposal",
    priority: Math.max(1, Math.min(10, Math.round(Number((deal as { probability?: number }).probability || 50) / 10))),
  }));

  const retentionItems: WorkItem[] = (overdueInvoices ?? []).map((invoice) => ({
    id: `invoice-${String((invoice as { id?: string }).id || crypto.randomUUID())}`,
    type: "retention",
    priority: 8,
  }));

  return [...dealItems, ...retentionItems].slice(0, 100);
}

export const GET = withRateLimit(async (_req: NextRequest) => {
  const workItems = await buildOptimizationWorkItems();

  const [pricingAdjustments, platformPriorities, workloadRebalance] = await Promise.all([
    optimizePricing(80),
    optimizePlatforms(30),
    balanceWorkload(workItems),
  ]);

  return NextResponse.json({
    success: true,
    asOf: new Date().toISOString(),
    pricingAdjustments,
    platformPriorities,
    workloadRebalance,
  });
}, {
  namespace: "api:ops:optimization",
  limit: 60,
  windowSeconds: 60,
});
