import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  buildEscalationQueue,
  type EscalatedJob,
} from "@/lib/ai/escalationEngine";

/**
 * GET /api/escalation
 * Returns jobs that require manual escalation (score 7-9, have portfolio/custom answer requirements)
 */
export async function GET() {
  try {
    // Fetch jobs from database that are candidates for escalation
    const { data: jobs, error } = await supabaseServer
      .from("jobs")
      .select("*")
      .gte("score", 7)
      .lt("score", 9)
      .order("score", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[escalation] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch escalation jobs" },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ jobs: [], count: 0 });
    }

    // Build escalation queue with reasons and actions
    const escalated = buildEscalationQueue(jobs);

    // Log escalations for audit trail
    if (escalated.length > 0) {
      const escalationRecords = escalated.map((job: EscalatedJob) => ({
        job_id: job.id,
        job_title: job.title,
        platform: job.platform,
        score: job.score,
        reasons: job.escalationReasons,
        manual_action: job.manualActionRequired,
      }));

      const { error: logError } = await supabaseServer
        .from("escalations")
        .insert(escalationRecords);

      if (logError) {
        console.warn("[escalation] Failed to log escalations:", logError);
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json({
      jobs: escalated,
      count: escalated.length,
      summary: {
        high: escalated.filter((j: EscalatedJob) => j.score >= 8).length,
        medium: escalated.filter((j: EscalatedJob) => j.score < 8).length,
      },
    });
  } catch (err) {
    console.error("[escalation] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
