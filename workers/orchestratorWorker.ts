import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  engineerAgent,
  optimizerAgent,
  plannerAgent,
  reviewerAgent,
  testerAgent,
  type AgentType,
  type EnqueueTaskInput,
  type EngineeringTask,
} from "../lib/engineering/agents.ts";
import type { FilePatch } from "../lib/engineering/patchExecutor.ts";
import { classifyTask } from "../lib/engineering/taskClassifier.ts";

loadEnv({ path: ".env.local" });

const execAsync = promisify(exec);
const MAX_TASKS_PER_CYCLE = 20;
const MAX_PATCHES_PER_TASK = 5;
const MAX_PARALLEL_ENGINEERS = 3;
const MAX_RETRIES = 3;

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function enqueueTask(input: EnqueueTaskInput) {
  await supabase.from("engineering_tasks").insert({
    task_type: input.task_type,
    agent_type: input.agent_type,
    status: "pending",
    priority: input.priority ?? 0,
    payload: input.payload || {},
    parent_task_id: input.parent_task_id || null,
    requires_human_approval: input.requires_human_approval ?? false,
  });
}

async function log(task: EngineeringTask, level: "info" | "warn" | "error", message: string, meta: Record<string, unknown> = {}) {
  await supabase.from("agent_logs").insert({
    task_id: task.id,
    agent_type: task.agent_type,
    level,
    message,
    meta,
  });
}

async function auditPatch(task: EngineeringTask, patch: FilePatch, result: "success" | "failure", errorMessage?: string) {
  await supabase.from("patch_logs").insert({
    task_id: task.id,
    agent: task.agent_type,
    patch_json: patch,
    result,
    error: errorMessage || null,
  });
}

async function auditPatchSet(task: EngineeringTask, patches: FilePatch[], result: "success" | "failure") {
  const totalSize = patches.reduce((sum, patch) => {
    return sum + Buffer.byteLength(patch.content || "", "utf-8");
  }, 0);
  await supabase.from("patch_logs").insert({
    task_id: task.id,
    agent: task.agent_type,
    patch_json: {
      summary: true,
      patch_count: patches.length,
      total_size: totalSize,
      files: patches.map((p) => p.file_path),
    },
    result,
    error: null,
  });
}

async function triggerDeploy(task: EngineeringTask) {
  const deployCommand = String(process.env.ENGINEERING_DEPLOY_COMMAND || "").trim();
  if (!deployCommand) {
    await log(task, "info", "Deploy hook skipped", {
      reason: "ENGINEERING_DEPLOY_COMMAND not configured",
    });
    return;
  }

  try {
    const result = await execAsync(deployCommand, { timeout: 300000 });
    await log(task, "info", "Deploy hook executed", {
      command: deployCommand,
      stdout: (result.stdout || "").slice(0, 2000),
      stderr: (result.stderr || "").slice(0, 2000),
    });
  } catch (error) {
    await log(task, "error", "Deploy hook failed", {
      command: deployCommand,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function rollbackLastChange(task: EngineeringTask, reason: string) {
  if (process.env.ENGINEERING_ENABLE_ROLLBACK !== "true") {
    await log(task, "warn", "Rollback skipped", {
      reason,
      hint: "Set ENGINEERING_ENABLE_ROLLBACK=true to enable git rollback",
    });
    return;
  }

  try {
    const result = await execAsync("git reset --hard HEAD~1", { timeout: 300000 });
    await log(task, "warn", "Rollback executed", {
      reason,
      stdout: (result.stdout || "").slice(0, 2000),
      stderr: (result.stderr || "").slice(0, 2000),
    });
  } catch (error) {
    await log(task, "error", "Rollback failed", {
      reason,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function markNeedsApproval(taskId: string, reason: string) {
  await supabase
    .from("engineering_tasks")
    .update({
      status: "needs_approval",
      error: reason,
    })
    .eq("id", taskId)
    .eq("status", "in_progress");
}

async function fetchNextTask(): Promise<EngineeringTask | null> {
  const nowIso = new Date().toISOString();

  const { data: pending } = await supabase
    .from("engineering_tasks")
    .select("id, task_type, agent_type, status, priority, payload, parent_task_id, requires_human_approval, approved_at, retries")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pending?.id) {
    return null;
  }

  const { data: claimed } = await supabase
    .from("engineering_tasks")
    .update({
      status: "in_progress",
      started_at: nowIso,
      error: null,
    })
    .eq("id", pending.id)
    .eq("status", "pending")
    .select("id, task_type, agent_type, status, priority, payload, parent_task_id, requires_human_approval, approved_at, retries")
    .maybeSingle();

  return (claimed as EngineeringTask | null) || null;
}

async function markTaskCompleted(taskId: string) {
  await supabase
    .from("engineering_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", taskId)
    .eq("status", "in_progress");
}

async function markTaskFailed(task: EngineeringTask, error: unknown) {
  const retries = Number(task.retries || 0) + 1;

  await supabase
    .from("engineering_tasks")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      retries,
      error: error instanceof Error ? error.message : String(error),
    })
    .eq("id", task.id)
    .eq("status", "in_progress");

  if (retries >= MAX_RETRIES) {
    await enqueueTask({
      task_type: "SELF_HEALING_TASK",
      agent_type: "PLANNER",
      priority: 5,
      payload: {
        goal: "Self-healing after orchestrator retries exceeded",
        retries_exceeded: true,
        source_task_id: task.id,
        failed_tasks: [task.id],
        logs: {
          message: error instanceof Error ? error.message : String(error),
        },
        recent_patches: Array.isArray(task.payload?.patches) ? task.payload.patches : [],
        system_metrics: {
          retries,
          max_retries: MAX_RETRIES,
        },
        tasks: [
          {
            feature: "self_healing_orchestrator_retry",
            context: "Task repeatedly failed during orchestrator execution",
          },
        ],
      },
      parent_task_id: task.id,
    });

    await rollbackLastChange(task, "orchestrator_retries_exceeded");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchTask(task: EngineeringTask) {
  if (task.agent_type === "ENGINEER") {
    const patchCount = Array.isArray(task.payload?.patches) ? task.payload.patches.length : 0;
    if (patchCount > MAX_PATCHES_PER_TASK) {
      throw new Error(`Task exceeds max patches per task (${MAX_PATCHES_PER_TASK})`);
    }
  }

  switch (task.agent_type as AgentType) {
    case "PLANNER":
      await plannerAgent(task, {
        enqueueTask,
        log,
        markNeedsApproval,
        auditPatch,
        auditPatchSet,
        rollbackLastChange,
        triggerDeploy,
        maxPatchesPerTask: MAX_PATCHES_PER_TASK,
      });
      return;

    case "ENGINEER": {
      const payload = task.payload;
      if (!payload.engineer_type) {
        payload.engineer_type = classifyTask(String(payload.goal || payload.feature || ""));
      }
      await engineerAgent(task, {
        enqueueTask,
        log,
        markNeedsApproval,
        auditPatch,
        auditPatchSet,
        rollbackLastChange,
        triggerDeploy,
        maxPatchesPerTask: MAX_PATCHES_PER_TASK,
      });
      return;
    }

    case "REVIEWER":
      await reviewerAgent(task, {
        enqueueTask,
        log,
        markNeedsApproval,
        auditPatch,
        auditPatchSet,
        rollbackLastChange,
        triggerDeploy,
        maxPatchesPerTask: MAX_PATCHES_PER_TASK,
      });
      return;

    case "TESTER":
      await testerAgent(task, {
        enqueueTask,
        log,
        markNeedsApproval,
        auditPatch,
        auditPatchSet,
        rollbackLastChange,
        triggerDeploy,
        maxPatchesPerTask: MAX_PATCHES_PER_TASK,
      });
      return;

    case "OPTIMIZER":
      await optimizerAgent(task, {
        enqueueTask,
        log,
        markNeedsApproval,
        auditPatch,
        auditPatchSet,
        rollbackLastChange,
        triggerDeploy,
        maxPatchesPerTask: MAX_PATCHES_PER_TASK,
      });
      return;

    default:
      await log(task, "warn", "Unknown agent_type; no-op", {});
  }
}

async function runEngineerTask(task: EngineeringTask): Promise<boolean> {
  try {
    await dispatchTask(task);
    const { data: current } = await supabase.from("engineering_tasks").select("status").eq("id", task.id).maybeSingle();
    if (current?.status === "in_progress") {
      await markTaskCompleted(task.id);
    }
    return true;
  } catch (error) {
    await markTaskFailed(task, error);
    await log(task, "error", "Agent task failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function orchestratorLoop() {
  while (true) {
    let processedInCycle = 0;
    let failedInCycle = 0;

    while (processedInCycle < MAX_TASKS_PER_CYCLE) {
      const remaining = MAX_TASKS_PER_CYCLE - processedInCycle;
      const batchSize = Math.min(MAX_PARALLEL_ENGINEERS, remaining);
      const tasks: EngineeringTask[] = [];

      for (let i = 0; i < batchSize; i += 1) {
        const nextTask = await fetchNextTask();
        if (!nextTask) {
          break;
        }
        tasks.push(nextTask);
      }

      if (tasks.length === 0) {
        break;
      }

      processedInCycle += tasks.length;
      const results = await Promise.all(tasks.map(runEngineerTask));
      failedInCycle += results.filter((success) => !success).length;
    }

    if (processedInCycle === 0) {
      await sleep(2000);
      continue;
    }

    const errorRate = failedInCycle / Math.max(1, processedInCycle);
    if (errorRate > 0.3) {
      await enqueueTask({
        task_type: "SELF_HEALING_TASK",
        agent_type: "PLANNER",
        priority: 4,
        payload: {
          goal: "Self-healing after elevated orchestrator error rate",
          error_rate: errorRate,
          failed_tasks: failedInCycle,
          system_metrics: {
            processed_in_cycle: processedInCycle,
            failed_in_cycle: failedInCycle,
          },
          tasks: [
            {
              feature: "self_healing_error_rate",
              context: "Reduce orchestrator failures and stabilize task loop",
            },
          ],
        },
      });
    }

    await sleep(500);
  }
}

void orchestratorLoop();