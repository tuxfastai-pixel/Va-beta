import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DISCOVERY_TASK_TYPES = ["JOB_DISCOVERY", "job_discovery", "crawler_discovery"];

type WorkerRunRow = {
  user_id: string | null;
};

async function getCrawlerLastRun() {
  const byTaskType = await supabase
    .from("worker_tasks")
    .select("updated_at, created_at")
    .eq("status", "completed")
    .in("task_type", DISCOVERY_TASK_TYPES)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byTaskType.error) {
    return byTaskType;
  }

  return supabase
    .from("worker_tasks")
    .select("updated_at, created_at")
    .eq("status", "completed")
    .in("type", DISCOVERY_TASK_TYPES)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function GET() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const [pendingTasksRes, inProgressTasksRes, workerRunsRes, crawlerTaskRes] =
    await Promise.all([
    supabase
      .from("worker_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("worker_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    supabase
      .from("ai_memory")
      .select("user_id")
      .eq("memory_type", "worker_last_run")
      .gte("created_at", tenMinutesAgo),
    getCrawlerLastRun(),
  ]);

  if (
    pendingTasksRes.error ||
    inProgressTasksRes.error ||
    workerRunsRes.error ||
    crawlerTaskRes.error
  ) {
    return Response.json(
      {
        error: "Failed to load health metrics",
        details: [
          pendingTasksRes.error?.message,
          inProgressTasksRes.error?.message,
          workerRunsRes.error?.message,
          crawlerTaskRes.error?.message,
        ].filter(Boolean),
      },
      { status: 500 }
    );
  }

  const uniqueWorkers = new Set(
    ((workerRunsRes.data || []) as WorkerRunRow[]).map((row) => row.user_id).filter(Boolean)
  );
  const crawlerLastRun = crawlerTaskRes.data?.updated_at || crawlerTaskRes.data?.created_at || null;
  const tasksProcessing = inProgressTasksRes.count || 0;

  return Response.json({
    workers_active: uniqueWorkers.size,
    tasks_pending: pendingTasksRes.count || 0,
    tasks_processing: tasksProcessing,
    crawler_last_run: crawlerLastRun,
    checked_at: new Date().toISOString(),
  });
}
