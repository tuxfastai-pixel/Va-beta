import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { Worker } from "bullmq";
import { crawlJobSources } from "../lib/jobs/crawler.ts";
import { ingestJobs } from "../lib/jobs/ingestionPipeline.ts";
import { runAllWorkers } from "./aiWorkerManager.ts";
import { runComplianceWorker } from "../lib/compliance/complianceWorker.ts";
import { logEvent } from "../lib/system/logging.ts";
import { runBookkeepingWorker, runDocProcessingWorker } from "../lib/workers/clientTaskWorkers.ts";
import { calculateTaskFee } from "../lib/billing/feeEngine.ts";
import { buildPaymentLinks } from "../lib/billing/paymentLinks.ts";
import { sendNotification } from "../lib/notifications/email.ts";

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
  client_id?: string;
  priority?: number;
  type?: WorkerTaskType;
  task_type?: WorkerTaskType;
  payload?: {
    user_id?: string;
    client_id?: string;
    markets?: string[];
    documents?: string[];
    stored_documents?: Array<{ storage_path?: string }>;
    country?: string;
    currency?: string;
    priority?: number;
  };
};

let wakeWaiter: (() => void) | null = null;

function wakeWorkerLoop() {
  if (wakeWaiter) {
    wakeWaiter();
    wakeWaiter = null;
  }
}

async function sleepUntilWakeOrTimeout(ms: number) {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      wakeWaiter = null;
      resolve();
    }, ms);

    wakeWaiter = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

function startWakeQueueListener() {
  const host = process.env.REDIS_HOST;

  if (!host) {
    return;
  }

  const port = Number(process.env.REDIS_PORT ?? 6379);
  const wakeQueueWorker = new Worker(
    "ai-worker-wakeup",
    async () => {
      wakeWorkerLoop();
      return { accepted: true };
    },
    {
      connection: {
        host,
        port,
      },
      concurrency: 5,
    }
  );

  wakeQueueWorker.on("error", (error) => {
    console.error("AI wake queue listener error", error);
  });
}

function getTaskType(task: WorkerTask): WorkerTaskType | "" {
  return (task.task_type || task.type || "") as WorkerTaskType | "";
}

async function fetchNextTask(): Promise<WorkerTask | null> {
  const nowIso = new Date().toISOString();

  const { data: pendingTask } = await supabase
    .from("worker_tasks")
    .select("id, client_id, type, task_type, payload, priority")
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
    .select("id, client_id, type, task_type, payload, priority")
    .maybeSingle();

  if (!claimedTask?.id) {
    return null;
  }

  return claimedTask as WorkerTask;
}

async function markStarted(taskId: string) {
  await supabase
    .from("worker_tasks")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", taskId);
}

async function markCompleted(taskId: string) {
  await supabase
    .from("worker_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", taskId);
}

async function markFailed(taskId: string, message: string) {
  await supabase
    .from("worker_tasks")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: message,
    })
    .eq("id", taskId);
}

async function runCrawler(payload: WorkerTask["payload"]) {
  if (payload?.user_id) {
    await ingestJobs(payload.user_id, payload.markets || []);
    return;
  }

  await crawlJobSources();
}

async function runMatcher(payload: WorkerTask["payload"]) {
  void payload;
  await runAllWorkers();
}

async function runAutoApply(payload: WorkerTask["payload"]) {
  void payload;
  await runAllWorkers();
}

async function runBookkeeping(payload: WorkerTask["payload"]) {
  await runBookkeepingWorker((payload || {}) as Record<string, unknown>);
}

async function runDocProcessing(payload: WorkerTask["payload"]) {
  await runDocProcessingWorker((payload || {}) as Record<string, unknown>);
}

function getTaskPriority(task: WorkerTask) {
  const directPriority = Number(task.priority ?? 0);
  if (Number.isFinite(directPriority)) {
    return directPriority;
  }

  const payloadPriority = Number(task.payload?.priority ?? 0);
  if (Number.isFinite(payloadPriority)) {
    return payloadPriority;
  }
  return 0;
}

function isBillableTask(taskType: WorkerTaskType | "") {
  return (
    taskType === "COMPLIANCE_TASK" ||
    taskType === "BOOKKEEPING_TASK" ||
    taskType === "DOCUMENT_PROCESSING"
  );
}

async function createClientInvoiceAndNotification(task: WorkerTask) {
  const taskType = getTaskType(task);
  if (!isBillableTask(taskType)) {
    return;
  }

  const clientId = String(task.client_id || task.payload?.client_id || "").trim();
  if (!clientId) {
    return;
  }

  const documentCount = Array.isArray(task.payload?.documents)
    ? task.payload?.documents?.length || 0
    : Array.isArray(task.payload?.stored_documents)
      ? task.payload?.stored_documents?.length || 0
      : 0;

  const fee = calculateTaskFee({
    taskType,
    country: task.payload?.country,
    documentCount,
    priority: getTaskPriority(task),
    currency: task.payload?.currency,
  });

  const paymentLinks = buildPaymentLinks({
    invoiceId: task.id,
    amount: fee.amount,
    currency: fee.currency,
    clientId,
  });

  const { error: invoiceError } = await supabase.from("client_invoices").insert({
    task_id: task.id,
    client_id: clientId,
    status: "issued",
    amount: fee.amount,
    amount_usd: fee.amount_usd,
    currency: fee.currency,
    fee_breakdown: {
      ...fee,
      country: task.payload?.country || "unknown",
      document_count: documentCount,
      task_type: taskType,
    },
    stripe_checkout_url: paymentLinks.stripe_checkout_url,
    paypal_checkout_url: paymentLinks.paypal_checkout_url,
    due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (invoiceError) {
    logEvent({
      type: "errors",
      task_id: task.id,
      message: `Failed to create invoice: ${invoiceError.message}`,
    });
    return;
  }

  const isHighValue = fee.amount_usd >= 500;
  const notificationType = isHighValue ? "high_value_alert" : "task_completed";

  await supabase.from("client_notifications").insert({
    client_id: clientId,
    task_id: task.id,
    notification_type: notificationType,
    priority: isHighValue ? "high" : "normal",
    title: isHighValue ? "High-value task completed" : "Task completed",
    message: isHighValue
      ? `Task ${task.id} completed. Priority invoice generated for ${fee.currency} ${fee.amount.toFixed(2)}.`
      : `Task ${task.id} completed. Invoice generated for ${fee.currency} ${fee.amount.toFixed(2)}.`,
    payload: {
      amount: fee.amount,
      amount_usd: fee.amount_usd,
      currency: fee.currency,
      stripe_checkout_url: paymentLinks.stripe_checkout_url,
      paypal_checkout_url: paymentLinks.paypal_checkout_url,
      task_type: taskType,
    },
  });

  const { data: clientRow } = await supabase
    .from("users")
    .select("email")
    .eq("id", clientId)
    .maybeSingle();

  const email = String(clientRow?.email || "").trim();
  if (email) {
    const subject = isHighValue ? "Priority alert: high-value task completed" : "Your task is complete";
    const body = [
      `Task ID: ${task.id}`,
      `Type: ${taskType}`,
      `Invoice amount: ${fee.currency} ${fee.amount.toFixed(2)}`,
      paymentLinks.stripe_checkout_url ? `Stripe: ${paymentLinks.stripe_checkout_url}` : "Stripe: not configured",
      paymentLinks.paypal_checkout_url ? `PayPal: ${paymentLinks.paypal_checkout_url}` : "PayPal: not configured",
    ].join("\n");

    await sendNotification(email, subject, body);
  }
}

export async function aiWorkerLoop() {
  startWakeQueueListener();

  while (true) {
    const task = await fetchNextTask();

    if (!task) {
      await sleepUntilWakeOrTimeout(3000);
      continue;
    }

    await markStarted(task.id);

    try {
      switch (getTaskType(task)) {
        case "JOB_DISCOVERY":
          await runCrawler(task.payload);
          break;

        case "JOB_MATCHING":
          await runMatcher(task.payload);
          break;

        case "JOB_APPLICATION":
          await runAutoApply(task.payload);
          break;

        case "COMPLIANCE_TASK":
          await runComplianceWorker(task.payload || {});
          break;

        case "BOOKKEEPING_TASK":
          await runBookkeeping(task.payload);
          break;

        case "DOCUMENT_PROCESSING":
          await runDocProcessing(task.payload);
          break;

        default:
          break;
      }

      await createClientInvoiceAndNotification(task);
      await markCompleted(task.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(task.id, message);
      logEvent({
        type: "errors",
        task_id: task.id,
        message,
      });
    }
  }
}

void aiWorkerLoop();
