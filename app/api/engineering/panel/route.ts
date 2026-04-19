import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type EngineeringTaskRow = {
  id: string;
  task_type: string;
  agent_type: string;
  status: string;
  priority: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  payload: Record<string, unknown>;
};

type AgentLogRow = {
  id: string;
  task_id: string | null;
  agent_type: string;
  level: string;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
};

type PatchLogRow = {
  id: string;
  task_id: string | null;
  agent: string;
  patch_json: Record<string, unknown>;
  result: string;
  error: string | null;
  created_at: string;
};

export async function GET() {
  const [activeRes, completedRes, failedRes, approvalRes, recentLogsRes, recentPatchLogsRes] = await Promise.all([
    supabaseServer
      .from("engineering_tasks")
      .select("id, task_type, agent_type, status, priority, error, created_at, started_at, completed_at, payload")
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseServer
      .from("engineering_tasks")
      .select("id, task_type, agent_type, status, priority, error, created_at, started_at, completed_at, payload")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(50),
    supabaseServer
      .from("engineering_tasks")
      .select("id, task_type, agent_type, status, priority, error, created_at, started_at, completed_at, payload")
      .eq("status", "failed")
      .order("completed_at", { ascending: false })
      .limit(50),
    supabaseServer
      .from("engineering_tasks")
      .select("id, task_type, agent_type, status, priority, error, created_at, started_at, completed_at, payload")
      .eq("status", "needs_approval")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseServer
      .from("agent_logs")
      .select("id, task_id, agent_type, level, message, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseServer
      .from("patch_logs")
      .select("id, task_id, agent, patch_json, result, error, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const error =
    activeRes.error ||
    completedRes.error ||
    failedRes.error ||
    approvalRes.error ||
    recentLogsRes.error ||
    recentPatchLogsRes.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const active = (activeRes.data || []) as EngineeringTaskRow[];
  const completed = (completedRes.data || []) as EngineeringTaskRow[];
  const failed = (failedRes.data || []) as EngineeringTaskRow[];
  const needsApproval = (approvalRes.data || []) as EngineeringTaskRow[];
  const logs = (recentLogsRes.data || []) as AgentLogRow[];
  const patchLogs = (recentPatchLogsRes.data || []) as PatchLogRow[];

  const testerRuns = completed.filter((task) => task.agent_type === "TESTER");

  return NextResponse.json({
    active_tasks: active,
    completed_tasks: completed,
    failed_tasks: failed,
    needs_approval: needsApproval,
    test_results: testerRuns,
    system_health: {
      pending: active.filter((task) => task.status === "pending").length,
      in_progress: active.filter((task) => task.status === "in_progress").length,
      completed: completed.length,
      failed: failed.length,
      needs_approval: needsApproval.length,
      updated_at: new Date().toISOString(),
    },
    recent_logs: logs,
    recent_patch_logs: patchLogs,
  });
}
