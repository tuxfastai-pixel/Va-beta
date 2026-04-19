import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  sendColdEmail,
  getAllActiveAccounts,
} from "@/lib/outreach/coldEmailEngine";
import {
  getPersonalizedTemplate,
  selectTemplate,
  addEmailFooter,
  sanitizeSubject,
  OutreachTarget,
  TemplateId,
} from "@/lib/outreach/emailTemplates";
import { trackFunnelEvent } from "@/lib/analytics/funnelTracking";
import {
  optimizeTemplateByResponseRate,
  selectBestTemplate,
} from "../../../../lib/outreach/templateOptimizer";

interface BulkSendRequest {
  targets: OutreachTarget[];
  accountIds?: string[]; // Optional: specify which accounts to use
  maxPerAccount?: number; // Default: 10
}

/**
 * Distribute targets across email accounts
 */
function distributeTargets(
  targets: OutreachTarget[],
  accountCount: number,
  maxPerAccount: number = 10
): Map<number, OutreachTarget[]> {
  const distribution = new Map<number, OutreachTarget[]>();

  // Initialize buckets
  for (let i = 0; i < accountCount; i++) {
    distribution.set(i, []);
  }

  // Distribute targets round-robin
  targets.forEach((target, index) => {
    const accountIdx = index % accountCount;
    distribution.get(accountIdx)?.push(target);
  });

  // Enforce per-account limit
  distribution.forEach((targets, idx) => {
    if (targets.length > maxPerAccount) {
      distribution.set(idx, targets.slice(0, maxPerAccount));
    }
  });

  return distribution;
}

export async function POST(req: Request) {
  try {
    const SAFE_MODE = process.env.SAFE_MODE === "true";

    if (SAFE_MODE) {
      return NextResponse.json(
        {
          preview: "SAFE_MODE enabled. Would send 100+ cold emails.",
          accounts: "5 active accounts",
          targets: "50 leads",
          rateLimit: "10 emails per account (to avoid throttling)",
          estimatedCost: "$0 (SMTP) + email reputation impact",
        },
        { status: 200 }
      );
    }

    const body = (await req.json().catch(() => null)) as BulkSendRequest | null;

    if (!body || !Array.isArray(body.targets) || body.targets.length === 0) {
      return NextResponse.json(
        { error: "targets array is required" },
        { status: 400 }
      );
    }

    const targets = body.targets;
    const maxPerAccount = body.maxPerAccount || 10;

    // Fetch email accounts
    let accounts = await getAllActiveAccounts();

    if (body.accountIds && body.accountIds.length > 0) {
      accounts = accounts.filter((acc) => body.accountIds!.includes(acc.id));
    }

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No active email accounts available" },
        { status: 400 }
      );
    }

    // Distribute targets across accounts
    const distribution = distributeTargets(targets, accounts.length, maxPerAccount);
    const bestTemplate = await selectBestTemplate().catch(() => null);
    const supportedTemplates: TemplateId[] = [
      "painPointFocused",
      "socialProofFocused",
      "curiosityLoop",
      "specificOffer",
      "caseStudy",
    ];

    let successCount = 0;
    let failureCount = 0;
    const results: Array<{
      target: OutreachTarget;
      accountEmail: string;
      success: boolean;
      error?: string;
    }> = [];

    // Send emails account by account to avoid rate limiting
    for (const [accountIdx, accountTargets] of distribution) {
      const account = accounts[accountIdx];

      if (!account) continue;

      // Check daily limit for this account
      if (account.sent_today >= account.daily_limit) {
        console.warn(
          `Account ${account.email} has reached daily limit (${account.sent_today}/${account.daily_limit})`
        );
        continue;
      }

      for (const target of accountTargets) {
        // Check if already sent to this email in the last 30 days
        const { data: existing } = await supabaseServer
          .from("cold_email_sends")
          .select("id")
          .eq("lead_email", target.email)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (existing) {
          results.push({
            target,
            accountEmail: account.email,
            success: false,
            error: "Already contacted in last 30 days",
          });
          failureCount++;
          continue;
        }

        // Generate personalized email
        const preferredId = bestTemplate?.id as TemplateId | undefined;
        const useBestTemplate = Boolean(preferredId && supportedTemplates.includes(preferredId));
        const selectedTemplate = useBestTemplate
          ? {
              templateId: preferredId as TemplateId,
              ...selectTemplate(preferredId as TemplateId, target),
            }
          : getPersonalizedTemplate(target);
        const { templateId, subject, text } = selectedTemplate;

        // Prepare email with safety measures
        const cleanSubject = sanitizeSubject(subject);
        const cleanText = addEmailFooter(text, account.email);

        // Send email
        const result = await sendColdEmail(account, {
          accountId: account.id,
          to: target.email,
          subject: cleanSubject,
          text: cleanText,
          leadId: target.id,
          templateId,
        });

        if (result.success) {
          successCount++;

          // Track funnel event: ad_click (outreach impression)
          await trackFunnelEvent({
            email: target.email,
            step: "ad_click",
            metadata: {
              campaign: "cold_outreach",
              account: account.email,
              company: target.company,
            },
          });

          results.push({
            target,
            accountEmail: account.email,
            success: true,
          });
        } else {
          failureCount++;
          results.push({
            target,
            accountEmail: account.email,
            success: false,
            error: result.error,
          });
        }

        // Small delay between sends to avoid rate limiting (100ms)
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Delay between accounts (1 second)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      templateActions: await optimizeTemplateByResponseRate(),
      success: true,
      summary: {
        totalTargets: targets.length,
        successful: successCount,
        failed: failureCount,
        successRate: successCount / targets.length,
      },
      accountsUsed: accounts.length,
      results: results.slice(0, 20), // Return first 20 for preview
      allResults: results.length > 20 ? `${results.length} total results` : undefined,
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

/**
 * GET: Get bulk send statistics
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "7");

    // Get stats from cold_email_stats view
    const { data: stats, error } = await supabaseServer
      .from("cold_email_stats")
      .select("*")
      .gte("date", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get account health
    const { data: accounts, error: accountError } = await supabaseServer
      .from("email_account_health")
      .select("*");

    if (accountError) {
      return NextResponse.json(
        { error: accountError.message },
        { status: 500 }
      );
    }

    // Calculate KPIs
    const totalSent = stats?.reduce((acc, s) => acc + (s.total_sent || 0), 0) || 0;
    const totalReplies = stats?.reduce((acc, s) => acc + (s.replies || 0), 0) || 0;
    const totalBounces = stats?.reduce((acc, s) => acc + (s.bounces || 0), 0) || 0;

    return NextResponse.json({
      period: `Last ${days} days`,
      kpis: {
        totalSent,
        totalReplies,
        totalBounces,
        overallReplyRate: totalSent > 0 ? (totalReplies / totalSent * 100).toFixed(2) + "%" : "0%",
        overallBounceRate: totalSent > 0 ? (totalBounces / totalSent * 100).toFixed(2) + "%" : "0%",
      },
      dailyStats: stats,
      accountHealth: accounts,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
