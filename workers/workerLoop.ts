import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { crawlJobSources } from "../lib/jobs/crawler.ts";
import { ingestJobs } from "../lib/jobs/ingestionPipeline.ts";
import { runAllWorkers } from "./aiWorkerManager.ts";
import { logEvent } from "../lib/system/logging.ts";
import { runComplianceWorker as runCompliancePipeline } from "../lib/compliance/complianceWorker.ts";
import { runBookkeepingWorker, runDocProcessingWorker } from "../lib/workers/clientTaskWorkers.ts";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type WorkerTaskType =
  | "JOB_DISCOVERY"
  | "JOB_MATCHING"
  | "JOB_APPLICATION"
  | "COMPLIANCE_TASK"
  | "BOOKKEEPING_TASK"
  | "DOCUMENT_PROCESSING";

type WorkerTask = {
  id: string;
  type: WorkerTaskType;
  task_type?: WorkerTaskType;
  payload?: {
    user_id?: string;
    markets?: string[];
    documents?: string[];
    country?: string;
  };
};

function getTaskType(task: WorkerTask): WorkerTaskType {
  return (task.task_type || task.type) as WorkerTaskType;
}

async function fetchNextTask(): Promise<WorkerTask | null> {
  const nowIso = new Date().toISOString();

  const { data: pendingTask } = await supabase
    .from("worker_tasks")
    .select("id, type, payload")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pendingTask?.id) {
    return null;
  }

  const { data: claimedTask } = await supabase
    .from("worker_tasks")
    .update({
      status: "in_progress",
      started_at: nowIso,
      error: null,
    })
    .eq("id", pendingTask.id)
    .eq("status", "pending")
    .select("id, type, payload")
    .maybeSingle();

  if (!claimedTask?.id) {
    return null;
  }

  return claimedTask as WorkerTask;
}

async function markTaskCompleted(taskId: string) {
  await supabase
    .from("worker_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", taskId);
}

async function markTaskFailed(taskId: string, error: unknown) {
  await supabase
    .from("worker_tasks")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
    .eq("id", taskId);
}

async function runCrawler(task: WorkerTask) {
  if (task.payload?.user_id) {
    const jobs = await ingestJobs(task.payload.user_id, task.payload.markets || []);

    logEvent({
      type: "jobs_discovered",
      worker_id: task.payload.user_id,
      count: jobs.length,
    });

    return;
  }

  const jobs = await crawlJobSources();
  logEvent({
    type: "jobs_discovered",
    count: jobs.length,
  });
}

async function matchJobs() {
  await runAllWorkers();
}

async function autoApply() {
  await runAllWorkers();
}

async function runComplianceTask(payload: WorkerTask["payload"]) {
  await runCompliancePipeline(payload || {});
}

async function runBookkeepingTask(payload: WorkerTask["payload"]) {
  await runBookkeepingWorker((payload || {}) as Record<string, unknown>);
}

async function runDocumentProcessingTask(payload: WorkerTask["payload"]) {
  await runDocProcessingWorker((payload || {}) as Record<string, unknown>);
}

export async function workerLoop() {
  const task = await fetchNextTask();

  if (!task) {
    return;
  }

  try {
    switch (getTaskType(task)) {
      case "JOB_DISCOVERY":
        await runCrawler(task);
        break;

      case "JOB_MATCHING":
        await matchJobs();
        break;

      case "JOB_APPLICATION":
        await autoApply();
        break;

      case "COMPLIANCE_TASK":
        await runComplianceTask(task.payload || {});
        break;

      case "BOOKKEEPING_TASK":
        await runBookkeepingTask(task.payload || {});
        break;

      case "DOCUMENT_PROCESSING":
        await runDocumentProcessingTask(task.payload || {});
        break;

      default:
        break;
    }

    await markTaskCompleted(task.id);
  } catch (error) {
    await markTaskFailed(task.id, error);
    logEvent({
      type: "errors",
      task_id: task.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const LEGACY_WORKER_LOOP_ENABLED = process.env.ENABLE_LEGACY_WORKER_LOOP === "true";

if (LEGACY_WORKER_LOOP_ENABLED) {
  setInterval(() => {
    void workerLoop();
  }, 60 * 1000);

  void workerLoop();
}
