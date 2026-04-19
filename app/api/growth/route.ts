import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { generatePitchDeck } from "@/lib/utils/pitchDeckGenerator";
import { generateReferralMessage } from "@/lib/growth/referralEngine";
import { generateContent } from "@/lib/growth/viralContentEngine";
import { generateCaseStudy } from "@/lib/utils/caseStudyGenerator";
import { getGrowthFlywheel } from "@/lib/growth/growthFlywheel";

export async function GET() {
  try {
    const [bestTemplateRes, rlActionsRes, referralsRes, contentRes, clientsRes, subscriptionsRes, jobsRes, logsRes] = await Promise.all([
      supabaseServer
        .from("outreach_templates")
        .select("*")
        .order("success_rate", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseServer
        .from("template_strategy")
        .select("*")
        .order("last_updated", { ascending: false })
        .limit(5),
      supabaseServer
        .from("referrals")
        .select("id", { count: "exact", head: true }),
      supabaseServer
        .from("case_studies")
        .select("id", { count: "exact", head: true }),
      supabaseServer
        .from("client_users")
        .select("id", { count: "exact", head: true }),
      supabaseServer
        .from("subscriptions")
        .select("amount, status"),
      supabaseServer
        .from("jobs")
        .select("id, title, description, duration, profit_realized, status, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
      supabaseServer
        .from("system_logs")
        .select("type, created_at")
        .in("type", ["scoring", "apply", "rl"])
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (bestTemplateRes.error) {
      throw new Error(bestTemplateRes.error.message);
    }

    if (rlActionsRes.error) {
      throw new Error(rlActionsRes.error.message);
    }

    if (referralsRes.error) {
      throw new Error(referralsRes.error.message);
    }

    if (contentRes.error) {
      throw new Error(contentRes.error.message);
    }

    if (clientsRes.error) {
      throw new Error(clientsRes.error.message);
    }

    if (subscriptionsRes.error) {
      throw new Error(subscriptionsRes.error.message);
    }

    if (jobsRes.error) {
      throw new Error(jobsRes.error.message);
    }

    const activeSubscriptions = (subscriptionsRes.data || []).filter((row) => row.status === "active");
    const monthlyRevenue = activeSubscriptions.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const arr = monthlyRevenue * 12;
    const clients = clientsRes.count || 0;
    const caseStudySource = jobsRes.data?.[0] || null;
    const contentMetrics = {
      time: caseStudySource?.duration || "24 hours",
      savings: 60,
    };
    const deckMetrics = {
      tam: Math.max(1000000, clients * 50000),
      clients,
      period: "30 days",
      arr,
      profit_multiplier: monthlyRevenue > 0 ? 3 : 0,
    };

    const logs: Array<{ type: string; created_at: string }> = logsRes.data || [];
    const lastOf = (type: string) =>
      logs.find((l) => l.type === type)?.created_at ?? null;

    return NextResponse.json({
      bestTemplate: bestTemplateRes.data || null,
      reinforcement: rlActionsRes.data || [],
      referrals: referralsRes.count || 0,
      contentPosts: contentRes.count || 0,
      flywheel: getGrowthFlywheel(),
      referralMessage: generateReferralMessage(),
      contentPreview: generateContent(contentMetrics),
      pitchDeck: generatePitchDeck(deckMetrics),
      caseStudyPreview: caseStudySource ? generateCaseStudy(caseStudySource) : null,
      automationStatus: {
        lastScoring: lastOf("scoring"),
        lastApply: lastOf("apply"),
        lastRL: lastOf("rl"),
      },
      metrics: {
        arr,
        clients,
        monthlyRevenue,
        activeSubscriptions: activeSubscriptions.length,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
