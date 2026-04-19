import { applyPatch, type FilePatch } from "./patchExecutor";
import { runCommand } from "./testRunner";
import { classifyTask, type EngineerType } from "./taskClassifier";
import { getRelevantMemory, storeMemory } from "@/lib/engineering/memory";

export const ENGINEER_AGENT_SYSTEM_PROMPT = `You are the Engineer Agent in an autonomous software engineering system.

Your job is to implement tasks by generating SAFE, MINIMAL, and PRECISE file patches.

You DO NOT explain. You DO NOT output text.
You ONLY output a JSON array of FilePatch objects.

-----------------------------------
GOAL
-----------------------------------
Implement the requested task using the smallest correct code change.

-----------------------------------
PATCH FORMAT (STRICT)
-----------------------------------
You must return:

[
  {
    "file_path": "string",
    "action": "create" | "update" | "delete",
    "content": "string (required for create/update)"
  }
]

-----------------------------------
RULES
-----------------------------------

1. Only modify files inside:
   - app/
   - lib/
   - workers/

2. NEVER touch:
   - node_modules/
   - .next/
   - dist/
   - build/
   - .env files

3. NEVER introduce breaking changes unless explicitly required.
4. ALWAYS preserve existing functionality.
5. PREFER editing existing files over creating new ones.
6. KEEP patches minimal.
7. ALL code must compile and follow project conventions.
8. If task is unclear, make the safest reasonable assumption and proceed minimally.
9. If multiple files are needed, include all patches in one response.
10. DO NOT output explanations, markdown, or comments outside code.

Strict mode: If you are not at least 90% confident in correctness, return [].`;

const BASE_ENGINEER_PROMPT = ENGINEER_AGENT_SYSTEM_PROMPT;

const FRONTEND_PROMPT = `
You are a Frontend Engineer.

Focus:
- UI components
- React / Next.js pages
- Styling
- Client-side logic

Rules:
- Do NOT modify backend or database logic
- Ensure UI compiles and renders
`;

const BACKEND_PROMPT = `
You are a Backend Engineer.

Focus:
- API routes
- Server logic
- Data handling

Rules:
- Do NOT modify UI components
- Ensure endpoints are functional and safe
`;

const DATABASE_PROMPT = `
You are a Database Engineer.

Focus:
- Schema design
- Queries
- Migrations

Rules:
- Do NOT modify UI or API layers unless required
- Ensure data integrity
`;

const DEVOPS_PROMPT = `
You are a DevOps Engineer.

Focus:
- Build systems
- CI/CD
- Performance
- Infrastructure

Rules:
- Do NOT modify business logic unless necessary
`;

function getSpecializedPrompt(type: string): string {
  switch (type) {
    case "frontend":
      return FRONTEND_PROMPT;
    case "backend":
      return BACKEND_PROMPT;
    case "database":
      return DATABASE_PROMPT;
    case "devops":
      return DEVOPS_PROMPT;
    default:
      return BACKEND_PROMPT;
  }
}

export type AgentType = "PLANNER" | "ENGINEER" | "REVIEWER" | "TESTER" | "OPTIMIZER";

export type EngineeringTask = {
  id: string;
  task_type: string;
  agent_type: AgentType;
  status: "pending" | "in_progress" | "completed" | "failed" | "needs_approval";
  priority: number;
  payload: Record<string, unknown>;
  parent_task_id?: string | null;
  requires_human_approval?: boolean;
  approved_at?: string | null;
  retries?: number;
};

export type EnqueueTaskInput = {
  task_type: string;
  agent_type: AgentType;
  priority?: number;
  payload?: Record<string, unknown>;
  parent_task_id?: string;
  requires_human_approval?: boolean;
};

export type AgentRuntime = {
  enqueueTask: (input: EnqueueTaskInput) => Promise<void>;
  log: (task: EngineeringTask, level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => Promise<void>;
  markNeedsApproval: (taskId: string, reason: string) => Promise<void>;
  auditPatch: (task: EngineeringTask, patch: FilePatch, result: "success" | "failure", errorMessage?: string) => Promise<void>;
  auditPatchSet: (task: EngineeringTask, patches: FilePatch[], result: "success" | "failure") => Promise<void>;
  rollbackLastChange: (task: EngineeringTask, reason: string) => Promise<void>;
  triggerDeploy: (task: EngineeringTask) => Promise<void>;
  maxPatchesPerTask: number;
};

const CONFIDENCE_THRESHOLD = 0.85;
const MAX_RETRIES = 3;

function asTaskList(goalPayload: Record<string, unknown>) {
  if (Array.isArray(goalPayload.tasks)) {
    return goalPayload.tasks.filter((task): task is Record<string, unknown> => Boolean(task) && typeof task === "object");
  }

  if (goalPayload.file || goalPayload.feature) {
    return [goalPayload];
  }

  return [{
    file: "unknown",
    feature: String(goalPayload.goal || "unspecified feature"),
  }];
}

function splitComplexPlannerTask(taskPayload: Record<string, unknown>): Record<string, unknown>[] {
  const goal = String(taskPayload.goal || taskPayload.feature || "").toLowerCase();
  const hasEngineerType = typeof taskPayload.engineer_type === "string";

  if (!hasEngineerType && goal.includes("dashboard") && (goal.includes("build") || goal.includes("create"))) {
    return [
      { ...taskPayload, goal: "Create dashboard UI", engineer_type: "frontend" },
      { ...taskPayload, goal: "Create dashboard API", engineer_type: "backend" },
      { ...taskPayload, goal: "Add dashboard data schema", engineer_type: "database" },
    ];
  }

  const engineerType = hasEngineerType
    ? String(taskPayload.engineer_type)
    : classifyTask(String(taskPayload.goal || taskPayload.feature || ""));

  return [{ ...taskPayload, engineer_type: engineerType }];
}

function getCrossAgentReviewerType(engineerType: string): EngineerType | null {
  if (engineerType === "database") {
    return "backend";
  }

  if (engineerType === "backend") {
    return "frontend";
  }

  return null;
}

function requiresApproval(task: EngineeringTask) {
  const explicit = Boolean(task.requires_human_approval || task.payload.requires_human_approval);
  if (explicit) {
    return true;
  }

  const text = JSON.stringify(task.payload).toLowerCase();
  return text.includes("migration") || text.includes("deploy") || text.includes("security");
}

function parseConfidence(payload: Record<string, unknown>) {
  const numeric = Number(payload.confidence ?? 1);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(0, Math.min(1, numeric));
}

function parsePatches(payload: Record<string, unknown>): FilePatch[] {
  const rawPatches = Array.isArray(payload.patches)
    ? payload.patches
    : payload.patch && typeof payload.patch === "object"
      ? [payload.patch]
      : [];

  const patches: FilePatch[] = [];
  for (const rawPatch of rawPatches) {
    if (!rawPatch || typeof rawPatch !== "object") {
      continue;
    }

    const patch = rawPatch as Record<string, unknown>;
    const filePath = String(patch.file_path || "").trim();
    const action = String(patch.action || "").trim();
    if (!filePath || (action !== "create" && action !== "update" && action !== "delete")) {
      continue;
    }

    patches.push({
      file_path: filePath,
      action,
      content: typeof patch.content === "string" ? patch.content : undefined,
    });
  }

  return patches;
}

export async function plannerAgent(task: EngineeringTask, runtime: AgentRuntime) {
  const generated = asTaskList(task.payload || {});
  const expanded = generated.flatMap(splitComplexPlannerTask);

  for (const nextPayload of expanded) {
    await runtime.enqueueTask({
      task_type: "CODE_CHANGE",
      agent_type: "ENGINEER",
      payload: nextPayload,
      parent_task_id: task.id,
      priority: 1,
    });
  }

  await runtime.log(task, "info", "Planner generated engineering tasks", {
    count: expanded.length,
    split_from: generated.length,
  });
}

export async function engineerAgent(task: EngineeringTask, runtime: AgentRuntime) {
  if (requiresApproval(task) && !task.approved_at) {
    await runtime.markNeedsApproval(task.id, "Human approval required for migration/deployment/security-sensitive change");
    await runtime.log(task, "warn", "Task moved to needs_approval", { reason: "approval_required" });
    return;
  }

  const confidence = parseConfidence(task.payload);
  const reviewerOverride = Boolean(task.payload.reviewer_override === true);

  if (confidence < CONFIDENCE_THRESHOLD && !reviewerOverride) {
    await runtime.log(task, "warn", "Engineer routed task to reviewer based on confidence", {
      file: task.payload.file || null,
      feature: task.payload.feature || null,
      confidence,
      threshold: CONFIDENCE_THRESHOLD,
    });

    await runtime.enqueueTask({
      task_type: "CODE_REVIEW",
      agent_type: "REVIEWER",
      payload: task.payload,
      parent_task_id: task.id,
      priority: 1,
    });
    return;
  }

  const payload = task.payload;
  if (!payload.engineer_type) {
    payload.engineer_type = classifyTask(String(payload.goal || payload.feature || ""));
  }
  const specializedPrompt = getSpecializedPrompt(String(payload.engineer_type || "backend"));
  const memory = await getRelevantMemory(String(payload.engineer_type || "backend"), String(payload.goal || payload.feature || ""));
  const memoryContext = memory
    .map((m) => `- ${String(m.category || "general")}: ${String(m.content || "")}`)
    .join("\n");
  const finalPrompt = `
${BASE_ENGINEER_PROMPT}

${specializedPrompt}

RELEVANT PAST LEARNINGS:
${memoryContext}
`;
  const engineerType = String(payload.engineer_type || "backend");

  const patches = parsePatches(task.payload);
  if (patches.length === 0) {
    await runtime.log(task, "warn", "Engineer received approved task with no executable patches", {
      file: task.payload.file || null,
      feature: task.payload.feature || null,
      engineer_type: engineerType,
      prompt_length: finalPrompt.length,
    });
    return;
  }

  if (patches.length > runtime.maxPatchesPerTask) {
    throw new Error(`Patch limit exceeded: ${patches.length} > ${runtime.maxPatchesPerTask}`);
  }

  let patchError: Error | null = null;
  for (const patch of patches) {
    try {
      await applyPatch(patch);
      await runtime.auditPatch(task, patch, "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await runtime.auditPatch(task, patch, "failure", msg);
      patchError = error instanceof Error ? error : new Error(msg);
      break;
    }
  }

  if (patchError) {
    await runtime.auditPatchSet(task, patches, "failure");
    throw patchError;
  }

  await runtime.auditPatchSet(task, patches, "success");
  await runtime.log(task, "info", "Engineer applied patches", {
    count: patches.length,
    files: patches.map((patch) => patch.file_path),
    prompt_version: "production-grade-v1",
    engineer_type: engineerType,
    confidence,
  });

  const reviewerType = getCrossAgentReviewerType(engineerType);
  if (reviewerType) {
    await runtime.enqueueTask({
      task_type: "CODE_REVIEW",
      agent_type: "REVIEWER",
      payload: {
        ...task.payload,
        cross_agent_review: true,
        reviewer_specialty: reviewerType,
      },
      parent_task_id: task.id,
      priority: 1,
    });
    return;
  }

  await runtime.enqueueTask({
    task_type: "TEST_RUN",
    agent_type: "TESTER",
    payload: task.payload,
    parent_task_id: task.id,
    priority: 1,
  });
}

export async function reviewerAgent(task: EngineeringTask, runtime: AgentRuntime) {
  const forceRework = Boolean(task.payload.force_rework);
  const crossAgentReview = Boolean(task.payload.cross_agent_review === true);

  if (forceRework) {
    await runtime.log(task, "warn", "Reviewer requested rework", { reason: "force_rework flag" });
    await runtime.enqueueTask({
      task_type: "CODE_CHANGE",
      agent_type: "ENGINEER",
      payload: task.payload,
      parent_task_id: task.id,
      priority: 2,
    });
    return;
  }

  if (crossAgentReview) {
    await runtime.log(task, "info", "Cross-agent review approved changes", {
      reviewer_specialty: task.payload.reviewer_specialty || null,
      engineer_type: task.payload.engineer_type || null,
    });
    await runtime.enqueueTask({
      task_type: "TEST_RUN",
      agent_type: "TESTER",
      payload: task.payload,
      parent_task_id: task.id,
      priority: 1,
    });
    return;
  }

  await runtime.log(task, "info", "Reviewer approved changes", {});
  await runtime.enqueueTask({
    task_type: "CODE_CHANGE",
    agent_type: "ENGINEER",
    payload: {
      ...task.payload,
      reviewer_override: true,
      confidence: Math.max(parseConfidence(task.payload), CONFIDENCE_THRESHOLD),
    },
    parent_task_id: task.id,
    priority: 1,
  });
}

export async function testerAgent(task: EngineeringTask, runtime: AgentRuntime) {
  const buildResult = await runCommand("npm run build");
  const lintResult = await runCommand("npm run lint");
  const runUnitTests = Boolean(task.payload.run_tests);
  const testResult = runUnitTests ? await runCommand("npm test") : null;

  await runtime.log(task, buildResult.success ? "info" : "error", "Build check completed", {
    success: buildResult.success,
    stderr: buildResult.stderr.slice(0, 2000),
    stdout: buildResult.stdout.slice(0, 2000),
  });

  await runtime.log(task, lintResult.success ? "info" : "error", "Lint check completed", {
    success: lintResult.success,
    stderr: lintResult.stderr.slice(0, 2000),
    stdout: lintResult.stdout.slice(0, 2000),
  });

  if (testResult) {
    await runtime.log(task, testResult.success ? "info" : "error", "Unit test check completed", {
      success: testResult.success,
      stderr: testResult.stderr.slice(0, 2000),
      stdout: testResult.stdout.slice(0, 2000),
    });
  }

  if (!buildResult.success || !lintResult.success || (testResult ? !testResult.success : false)) {
    const engineerType = String(task.payload.engineer_type || "backend");
    const goalText = String(task.payload.goal || task.payload.feature || "unspecified task");
    const errorSummary = [buildResult.stderr, lintResult.stderr, testResult?.stderr || ""]
      .filter(Boolean)
      .join("\n")
      .slice(0, 500);
    await storeMemory({
      agent_type: engineerType,
      category: "failure",
      content: `Failed attempt: ${errorSummary || goalText}`,
      metadata: {
        source_task_id: task.id,
        goal: goalText,
      },
    });

    const attempt = Number(task.payload.repair_attempt || 0) + 1;

    if (!buildResult.success) {
      await runtime.enqueueTask({
        task_type: "SELF_HEALING_TASK",
        agent_type: "PLANNER",
        payload: {
          goal: "Investigate repeated build failures in engineering orchestrator",
          build_fails: true,
          source_task_id: task.id,
          error_log: {
            build_stderr: buildResult.stderr.slice(0, 2000),
            lint_stderr: lintResult.stderr.slice(0, 2000),
          },
          tasks: [
            {
              feature: "self_healing_build_fix",
              context: "Root-cause build break introduced by engineering patch",
            },
          ],
        },
        parent_task_id: task.id,
        priority: 3,
      });
    }

    if (attempt >= MAX_RETRIES) {
      await runtime.rollbackLastChange(task, "tester_retries_exceeded");
      await runtime.enqueueTask({
        task_type: "SELF_HEALING_TASK",
        agent_type: "PLANNER",
        payload: {
          goal: "Self-healing after retries exceeded",
          retries_exceeded: true,
          source_task_id: task.id,
          logs: {
            build_stderr: buildResult.stderr.slice(0, 2000),
            lint_stderr: lintResult.stderr.slice(0, 2000),
            test_stderr: testResult?.stderr?.slice(0, 2000) || "",
          },
          failed_tasks: [task.id],
          recent_patches: Array.isArray(task.payload.patches) ? task.payload.patches : [],
          system_metrics: {
            attempt,
            max_retries: MAX_RETRIES,
          },
          tasks: [
            {
              feature: "self_healing_retry_exceeded",
              context: "Rollback executed after repeated tester failures",
            },
          ],
        },
        parent_task_id: task.id,
        priority: 5,
      });
      return;
    }

    const retryHints: Record<string, unknown> = {};
    if (attempt === 1) {
      retryHints.add_more_context = true;
    } else if (attempt === 2) {
      retryHints.broaden_fix_scope = true;
    }

    await runtime.enqueueTask({
      task_type: "CODE_CHANGE",
      agent_type: "ENGINEER",
      payload: {
        ...task.payload,
        reviewer_override: true,
        confidence: 1,
        repair_attempt: attempt,
        test_failure: {
          build_ok: buildResult.success,
          lint_ok: lintResult.success,
          tests_ok: testResult ? testResult.success : null,
        },
        error_log: {
          build_stderr: buildResult.stderr.slice(0, 2000),
          lint_stderr: lintResult.stderr.slice(0, 2000),
          test_stderr: testResult?.stderr?.slice(0, 2000) || "",
        },
        ...retryHints,
      },
      parent_task_id: task.id,
      priority: 3,
    });
    return;
  }

  const engineerType = String(task.payload.engineer_type || "backend");
  const goalText = String(task.payload.goal || task.payload.feature || "unspecified task");
  await storeMemory({
    agent_type: engineerType,
    category: "success",
    content: `Successful fix: ${goalText}`,
    metadata: {
      source_task_id: task.id,
      goal: goalText,
    },
  });

  const recent = await getRelevantMemory(engineerType, goalText);
  const successfulRepeats = recent.filter((m) => String(m.category) === "success").length;
  if (successfulRepeats >= 2) {
    await storeMemory({
      agent_type: engineerType,
      category: "pattern",
      content: `Repeated successful pattern detected for goal: ${goalText}`,
      metadata: {
        source_task_id: task.id,
        repeats: successfulRepeats,
      },
    });
  }

  await runtime.enqueueTask({
    task_type: "OPTIMIZE",
    agent_type: "OPTIMIZER",
    payload: task.payload,
    parent_task_id: task.id,
    priority: 1,
  });

  await runtime.triggerDeploy(task);
}

export async function optimizerAgent(task: EngineeringTask, runtime: AgentRuntime) {
  if (task.payload.optimizer_generated === true) {
    await runtime.log(task, "info", "Optimizer skipped task regeneration", {
      reason: "optimizer_generated payload already processed",
    });
    return;
  }

  const goals = [
    "Reduce retry count for failing tasks from 3 to 2 in orchestratorWorker.ts",
    "Increase worker concurrency from default 5 to 8 in aiWorker.ts batch processing",
    "Add caching to repeated engineering panel API calls in app/api/engineering/panel/route.ts",
    "Introduce debounce on task creation to prevent duplicate submissions in app/api/engineering/tasks/route.ts",
  ];

  for (const goal of goals) {
    await runtime.enqueueTask({
      task_type: "CODE_CHANGE",
      agent_type: "ENGINEER",
      payload: {
        goal,
        feature: "performance_optimization",
        action: "OPTIMIZATION_TASK",
        optimizer_generated: true,
      },
      parent_task_id: task.id,
      priority: 1,
    });
  }

  await runtime.log(task, "info", "Optimizer generated actionable engineering tasks", {
    count: goals.length,
  });
}
