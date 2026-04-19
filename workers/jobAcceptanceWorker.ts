import { config as loadEnv } from "dotenv";
import cron from "node-cron";
import { promoteQualifiedJobMatches, getTopSimilarJobMemories } from "../lib/jobs/jobMatchPromoter";
import { enqueueEngineeringTask } from "../lib/engineering/enqueueEngineeringTask";
import { supabase } from "../lib/supabase";

loadEnv({ path: ".env.local" });

const PROMOTE_INTERVAL_MINUTES = Number(process.env.JOB_ACCEPT_INTERVAL_MINUTES ?? 5);
const SEMANTIC_QUERY = "find high-paying, low-risk jobs";

async function storeEngineeringLoop({ topJobs, promoted }: { topJobs: Awaited<ReturnType<typeof getTopSimilarJobMemories>>; promoted: number }) {
  if (promoted === 0 || topJobs.length === 0) {
    return;
  }

  await enqueueEngineeringTask(
    {
      goal: "Analyse top semantic job matches and optimise acceptance criteria",
      source: "job_acceptance_worker",
      promoted_count: promoted,
      top_jobs: topJobs.map((row) => ({
        job_match_id: row.job_match_id,
        context: row.context,
      })),
    },
    1
  );
}

async function runCycle() {
  const started = Date.now();
  console.log(`[JobAcceptanceWorker] Cycle started at ${new Date(started).toISOString()}`);

  let promoted = 0;

  try {
    promoted = await promoteQualifiedJobMatches();
    console.log(`[JobAcceptanceWorker] Promoted ${promoted} job match(es) to jobs table`);
  } catch (err) {
    console.error("[JobAcceptanceWorker] Promotion error:", err instanceof Error ? err.message : String(err));
    await supabase.from("agent_logs").insert({
      task_id: null,
      agent_type: "PLANNER",
      level: "error",
      message: "Job acceptance promotion cycle failed",
      meta: { error: err instanceof Error ? err.message : String(err) },
    });
    return;
  }

  let topJobs: Awaited<ReturnType<typeof getTopSimilarJobMemories>> = [];

  try {
    topJobs = await getTopSimilarJobMemories(SEMANTIC_QUERY);
    console.log(`[JobAcceptanceWorker] Retrieved ${topJobs.length} top semantic job memories`);
  } catch (err) {
    console.warn("[JobAcceptanceWorker] Semantic retrieval error (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  try {
    await storeEngineeringLoop({ topJobs, promoted });
  } catch (err) {
    console.warn("[JobAcceptanceWorker] Engineering enqueue error (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  const elapsed = Date.now() - started;
  console.log(`[JobAcceptanceWorker] Cycle completed in ${elapsed}ms`);
}

console.log(`[JobAcceptanceWorker] Starting — cycle every ${PROMOTE_INTERVAL_MINUTES} minute(s)`);

void runCycle();

cron.schedule(`*/${PROMOTE_INTERVAL_MINUTES} * * * *`, () => {
  void runCycle();
});
