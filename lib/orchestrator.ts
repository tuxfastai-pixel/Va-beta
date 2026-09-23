import { runUserCycle } from "@/lib/orchestrator/userCycle";
import { loadActiveUsers, loadUserById } from "@/lib/orchestrator/userLoader";
import { sendEmailAlert } from "@/lib/alerts/email";
import { sendWhatsApp } from "@/lib/alerts/whatsapp";
import { saveJobs } from "@/lib/db/saveJobs";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchAllJobs } from "@/lib/platforms/connectors";
import { getTodayRevenue } from "@/lib/revenue/tracker";
import { buildDailySummary } from "@/lib/reports/dailySummary";
import { analyzeTender } from "@/lib/tenders/tenderAssistant";
import { checkDeadlines } from "@/lib/tenders/alerts";
import { generateCompliancePack } from "@/lib/tenders/compliancePack";
import { fetchTenders } from "@/lib/tenders/fetchTenders";
import { generateProposal } from "@/lib/tenders/proposalGenerator";
import { buildSubmission } from "@/lib/tenders/submissionBuilder";
import { trackTender } from "@/lib/tenders/tracker";
import { getAlertableJobs, getEscalationCandidates } from "@/lib/ai/priorityEngine";
import { isAutoApplySafe, getRemainingAutoApplies, type AutoApplyStats } from "@/lib/ai/autoApplyEngine";
import { buildEscalationQueue } from "@/lib/ai/escalationEngine";
import { buildFollowUpBatch } from "@/lib/followups/followupEngine";
import { processRecurringBilling } from "@/lib/billing/recurring";
import { markOverdueInvoices } from "@/lib/invoices/generator";
import { runAgentWorkforce } from "@/lib/agents/workforce";
import { checkOverdueSLAs } from "@/lib/sla/slaEngine";
import { logger } from "@/lib/logger/logger";
import { runIntelligenceCycle } from "@/lib/intelligence/runtime";
import { acquireLock, releaseLock } from "@/lib/runtime/lockManager";
import { withTaskReservation } from "@/lib/runtime/taskReservation";
import { isOrchestratorPausedGlobally } from "@/lib/intelligence/governance";
import type { Job } from "@/types";

type RunOrchestratorInput = {
  userId?: string;
};

async function persistTenders(tenders: Array<{ id: string; title: string; deadline: Date; status: string; score?: number; meta?: Record<string, unknown> }>) {
  if (tenders.length === 0) {
    return;
  }

  await supabaseServer.from("tenders").upsert(
    tenders.map((tender) => ({
      id: tender.id,
      title: tender.title ?? undefined,
      deadline: tender.deadline.toISOString(),
      status: tender.status,
      score: Number(tender.score || 0),
      meta: tender.meta || {},
    })),
    { onConflict: "id", ignoreDuplicates: false }
  );
}

export async function runOrchestrator({ userId }: RunOrchestratorInput) {
  const manualApplicationMode = process.env.PILOT_MANUAL_APPLICATION_MODE !== "false";
  const autoApplyEnabled = process.env.ENABLE_AUTO_APPLY === "true" && !manualApplicationMode;

  if (await isOrchestratorPausedGlobally()) {
    return {
      mode: userId ? "user" : "auto",
      skipped: true,
      reason: "orchestrator paused by governance",
    };
  }

  if (!userId) {
    const orchestratorId = `orchestrator:auto:${process.env.VERCEL_REGION || "local"}`;
    const cycleLock = await acquireLock("orchestrator:auto:global", orchestratorId, {
      leaseSeconds: 240,
      retryWindowMs: 500,
      maxRetries: 1,
      metadata: { mode: "auto" },
    });

    if (!cycleLock.acquired) {
      return {
        mode: "auto",
        skipped: true,
        reason: "global orchestrator lock already held",
      };
    }

    try {
    const [jobs, tenders, revenue] = await Promise.all([
      fetchAllJobs(),
      fetchTenders(),
      getTodayRevenue(),
    ]);

    await saveJobs(jobs);

    // 🎯 PRIORITY FILTERING
    // Normalize connector values before passing jobs to stricter engines
    const priorityJobs: Job[] = jobs.map((job) => ({
      ...job,
      budget: typeof job.budget === "number" ? job.budget : undefined,
      type: job.type ?? undefined,
    }));

    // Filter jobs by priority level - only alert on critical/high
    const alertableJobs = getAlertableJobs(priorityJobs);
    const escalationCandidates = getEscalationCandidates(priorityJobs);

    // ðŸ¤– AUTO-APPLY ENGINE
    // Track auto-applies for rate limiting
    const autoApplyStats: AutoApplyStats = {
      appliedToday: 0,
      appliedThisMonth: 0,
    };

    // In production, fetch these from database
    // const { data: appliedToday } = await supabaseServer
    //   .from("auto_applications")
    //   .select("*")
    //   .eq("applied_at", today);

    const autoApplyQueue = [];
    if (autoApplyEnabled) {
      for (const job of alertableJobs) {
        if (isAutoApplySafe(job, autoApplyStats)) {
          const reservation = await withTaskReservation(
            `auto-apply:${job.id}`,
            `auto-apply:${job.id}`,
            orchestratorId,
            async () => {
              autoApplyQueue.push({
                jobId: job.id,
                title: job.title,
                platform: job.platform,
                link: job.link,
                score: job.score,
              });

              const { error } = await supabaseServer.from("auto_applications").insert({
                job_id: job.id,
                job_title: job.title,
                platform: job.platform,
                applied_at: new Date(),
                status: "pending",
              });

              if (!error) {
                autoApplyStats.appliedToday++;
              }
            },
            {
              timeoutSeconds: 180,
              payload: { title: job.title, platform: job.platform },
            }
          );

          if (!reservation.reserved) {
            logger.info("[ORCH] Skipped duplicate auto-apply", { jobId: job.id, reason: reservation.reason }, "orchestrator");
          }
        }
      }
    }

    // ðŸ“Š ESCALATION ENGINE
    const escalations = buildEscalationQueue(escalationCandidates);

    // ðŸ§  INTELLIGENCE CYCLE
    // Forecast saturation, rebalance workload, optimize pricing/platforms,
    // and apply bounded reinforcement updates before action execution.
    const intelligenceJobs = alertableJobs.flatMap((job) =>
      job.id == null
        ? []
        : [{
            id: String(job.id),
            score: job.score,
            title: job.title,
          }],
    );

    const intelligence = await runIntelligenceCycle({ jobs: intelligenceJobs }).catch((error) => {
      logger.warn("[ORCH] Intelligence cycle failed", { error: String(error) }, "orchestrator");
      return null;
    });

    // Tender processing
    const trackedTenders = tenders.map((tender) => {
      const tracked = trackTender({
        id: tender.id,
        title: tender.title ?? undefined,
        closingDate: tender.closingDate ?? undefined,
      });

      return {
        ...tracked,
        score: Number(tender.score || 0),
        meta: {
          ...analyzeTender({ description: String(tender.title ?? "") }),
          autoPrepareSubmission: Number(tender.valueScore || 0) < 4,
          flagForManualReview: Number(tender.valueScore || 0) >= 4,
        },
      };
    });

    await persistTenders(trackedTenders);

    const urgentTenders = checkDeadlines(trackedTenders).map((urgentTender) => {
      const matchingTender = trackedTenders.find(
        (trackedTender) =>
          new Date(trackedTender.deadline).getTime() ===
          new Date(urgentTender.deadline).getTime(),
      );

      return {
        ...urgentTender,
        title: matchingTender?.title ?? "Tender deadline",
      };
    });
    const preparedSubmissions = tenders.map((tender) => {
      const proposal = generateProposal(tender);
      const compliance = generateCompliancePack();
      const submission = buildSubmission(tender, proposal, compliance);

      return {
        tenderId: submission.tenderId,
        ready: submission.ready,
        manualReview: Number(tender.valueScore || 0) >= 4,
      };
    });

    // ðŸ“§ FOLLOW-UP ENGINE
    // Get pending follow-ups
    const { data: applications } = await supabaseServer
      .from("auto_applications")
      .select("id, job_title, applied_at")
      .in("status", ["pending", "responded"]);

    const followUps = await buildFollowUpBatch(
      applications?.map((app) => ({
        id: app.id,
        jobTitle: app.job_title,
        appliedAt: new Date(app.applied_at),
      })) || []
    );

    // ðŸ’° RECURRING BILLING (reserved to avoid duplicate invoice cycles)
    const billingReservation = await withTaskReservation(
      `billing-cycle:${new Date().toISOString().slice(0, 10)}`,
      "billing-cycle",
      orchestratorId,
      async () => {
        const billingResult = await processRecurringBilling();
        const overdueCount = await markOverdueInvoices();
        return { billingResult, overdueCount };
      },
      { timeoutSeconds: 300 }
    );

    const billingResult = billingReservation.result?.billingResult ?? { processed: 0, invoicesCreated: 0 };
    const overdueCount = billingReservation.result?.overdueCount ?? 0;

    // ðŸ¤– AGENT WORKFORCE
    const workforce = await runAgentWorkforce({ jobs: alertableJobs }).catch((e) => {
      logger.warn("[ORCH] Agent workforce error", { error: String(e) }, "orchestrator");
      return null;
    });

    // ðŸ“… SLA CHECK
    const overdueSLAs = await checkOverdueSLAs().catch(() => []);

    // ðŸ“± BUILD ALERT MESSAGE
    const alertSummary = buildDailySummary({
      jobs: alertableJobs,
      tenders: urgentTenders,
      revenue,
    });

    let alertMessage = alertSummary;

    // Add escalation count to alert
    if (escalations.length > 0) {
      alertMessage += `\n\nâš ï¸ ESCALATIONS: ${escalations.length} high-value opportunities waiting for manual review`;
    }

    // Add auto-apply count
    if (autoApplyQueue.length > 0) {
      alertMessage += `\nâœ… AUTO-APPLIED: ${autoApplyQueue.length} jobs`;
      alertMessage += `\nðŸ“Š Rate limit: ${getRemainingAutoApplies(autoApplyStats)}/20 remaining`;
    } else if (!autoApplyEnabled) {
      alertMessage += "\nðŸ›¡ï¸ MANUAL APPLY MODE: auto-apply disabled for pilot";
    }

    // Add follow-ups
    if (followUps.length > 0) {
      alertMessage += `\nðŸ“© FOLLOW-UPS: ${followUps.length} scheduled`;
    }

    // Add billing updates
    if (billingResult.invoicesCreated > 0) {
      alertMessage += `\nðŸ’³ RECURRING BILLING: ${billingResult.invoicesCreated} invoices created`;
    }

      // Add workforce + SLA summary
      if (workforce) {
        alertMessage += `\nðŸ¤– AGENTS: ${workforce.leadsFound} leads found, ${workforce.invoicesCreated} invoices`;
      }
      if (overdueSLAs.length > 0) {
        alertMessage += `\nâ° OVERDUE SLAs: ${overdueSLAs.length} milestone(s) past due`;
      }
      if (intelligence) {
        alertMessage += `\nðŸ§  INTELLIGENCE: capacity risk ${intelligence.capacityForecast.slaBreachProbability}%`;
        if (intelligence.adaptiveActionsApplied) {
          alertMessage += ` Â· adaptive actions applied (${intelligence.workloadPlan.length} workload assignments)`;
        } else {
          alertMessage += " Â· adaptive actions deferred (cooldown/confidence guard)";
        }
      }

    // ðŸ”” SEND ALERTS (only if critical/high value or escalations)
    if (alertableJobs.length > 0 || urgentTenders.length > 0 || escalations.length > 0) {
      await sendEmailAlert("Daily AI Report", alertMessage);
      await sendWhatsApp(alertMessage);
    }

    // Process user cycles
    const users = await loadActiveUsers();

    for (const user of users) {
      if (user.system_paused) {
        continue;
      }

      await runUserCycle(user);
    }

    return {
      mode: "auto",
      usersProcessed: users.length,
      jobsFound: jobs.length,
      alertableJobs: alertableJobs.length,
      escalations: escalations.length,
      autoApplied: autoApplyQueue.length,
      autoApplyEnabled,
      manualApplicationMode,
      followUpScheduled: followUps.length,
      tendersFound: tenders.length,
      urgentTenderAlerts: urgentTenders.length,
      preparedSubmissions,
      recurringBillingProcessed: billingResult.processed,
      invoicesCreated: billingResult.invoicesCreated,
      overdueMarked: overdueCount,
      revenueToday: revenue,
      agentWorkforce: workforce,
      overdueSLAs: overdueSLAs.length,
      intelligence,
    };
    } finally {
      await releaseLock("orchestrator:auto:global", orchestratorId);
    }
  }

  const user = await loadUserById(String(userId));

  if (!user) {
    throw new Error("User not found");
  }

  return runUserCycle(user);
}
