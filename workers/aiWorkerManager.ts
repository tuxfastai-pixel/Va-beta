import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { runWorker } from "../lib/agents/aiWorker.ts";
import { getWorkers } from "../lib/db/workers.ts";
import { logEvent } from "../lib/system/logging.ts";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function saveWorkerRun(userId: string, workerName: string) {
  await supabase.from("ai_memory").insert({
    user_id: userId,
    memory_type: "worker_last_run",
    content: {
      worker_name: workerName,
      ran_at: new Date().toISOString(),
    },
  });
}

async function saveWorkerError(userId: string, workerName: string, error: unknown) {
  await supabase.from("ai_memory").insert({
    user_id: userId,
    memory_type: "worker_last_error",
    content: {
      worker_name: workerName,
      message: error instanceof Error ? error.message : String(error),
      failed_at: new Date().toISOString(),
    },
  });
}

export async function runAllWorkers() {
  const workers = await getWorkers();

  for (const worker of workers) {
    try {
      const result = await runWorker(worker);
      await saveWorkerRun(worker.user_id, worker.worker_name);
      logEvent({
        type: "worker_cycle_completed",
        worker_name: worker.worker_name,
        jobs_discovered: result.jobsFoundToday,
        applications_sent: result.applicationsSent,
        earnings: result.earnings,
      });
    } catch (error) {
      await saveWorkerError(worker.user_id, worker.worker_name, error);
      logEvent({
        type: "errors",
        worker_name: worker.worker_name,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error(`AI worker failed: ${worker.worker_name}`, error);
    }
  }

  return workers.length;
}

async function startManager() {
  const count = await runAllWorkers();
  console.log(`AI worker manager cycle completed for ${count} workers`);
}

void startManager();

setInterval(() => {
  void startManager();
}, 60 * 60 * 1000);
