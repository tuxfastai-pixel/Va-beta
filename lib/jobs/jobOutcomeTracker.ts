import { supabase } from "@/lib/supabase";
import { trackEarnings } from "@/lib/earnings/tracker";
import { updateReputation } from "@/lib/users/reputation";

type JobForPatternReduction = {
  id: string;
  title?: string | null;
  company?: string | null;
};

/**
 * Reduce future promotion weight for job patterns that didn't succeed.
 * Stores a "failed_pattern" memory entry so the matcher deprioritises similar jobs.
 */
async function reduceWeightForPattern(job: JobForPatternReduction): Promise<void> {
  await supabase.from("ai_memory").insert({
    memory_type: "failed_pattern",
    content: {
      job_id: job.id,
      title: job.title ?? null,
      company: job.company ?? null,
      reason: "job_outcome_failure",
    },
    created_at: new Date().toISOString(),
  });
}

/**
 * Call this after a job finishes (success or failure).
 *
 * Steps:
 *  2 — Update jobs.success + jobs.profit_realized
 *  3 — If successful and profitable, write profit_score back into ai_memory
 *  4 — If failed, reduce promotion weight for this job pattern
 */
export async function recordJobOutcome(
  jobId: string,
  jobMatchId: string,
  userId: string,
  success: boolean,
  profit: number
): Promise<void> {
  // STEP 2 — persist outcome on the job row
  const { error: updateErr } = await supabase
    .from("jobs")
    .update({ success, profit_realized: profit })
    .eq("id", jobId);

  if (updateErr) {
    throw new Error(`Failed to update job outcome for ${jobId}: ${updateErr.message}`);
  }

  // STEP 3 — feed profit back into memory so future matches are better weighted
  if (success && profit > 70) {
    const { error: memErr } = await supabase
      .from("ai_memory")
      .update({ profit_score: profit })
      .eq("job_match_id", jobMatchId);

    if (memErr) {
      throw new Error(`Failed to update ai_memory profit_score for match ${jobMatchId}: ${memErr.message}`);
    }
  }

  if (success && profit > 0) {
    await trackEarnings(userId, profit, "job");
  }

  await updateReputation(userId, success);

  // STEP 4 — adapt: deprioritise this pattern on failure
  if (!success) {
    const { data: job } = await supabase
      .from("jobs")
      .select("id, title, company")
      .eq("id", jobId)
      .maybeSingle();

    if (job) {
      await reduceWeightForPattern(job);
    }
  }
}

type JobOutcomeInput = {
  id: string;
  user_id: string;
  title?: string | null;
  pay_amount?: number | string | null;
  profit_score?: number | string | null;
  success: boolean;
};

export async function handleJobOutcome(job: JobOutcomeInput) {
  const payAmount = Number(job.pay_amount || 0);
  const profitScore = Number(job.profit_score || 0);

  await updateReputation(job.user_id, job.success);

  if (job.success && payAmount > 0) {
    await trackEarnings(job.user_id, payAmount, "job");
  }

  if (job.success && profitScore > 70) {
    const title = String(job.title || "Untitled Job");
    const caseStudyTitle = `Completed: ${title}`;
    const caseStudyContent = `Earned $${payAmount} by completing ${title} using AI automation.`;

    const { error: caseStudyError } = await supabase
      .from("case_studies")
      .insert({
        job_id: job.id,
        title: caseStudyTitle,
        content: caseStudyContent,
        created_at: new Date().toISOString(),
      });

    if (caseStudyError) {
      throw new Error(`Failed to create case study for job ${job.id}: ${caseStudyError.message}`);
    }
  }
}
