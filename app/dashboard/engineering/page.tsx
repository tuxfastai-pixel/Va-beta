"use client";

import { useEffect, useMemo, useState } from "react";

type EngineeringTask = {
  id: string;
  task_type: string;
  agent_type: string;
  status: string;
  priority: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

type PanelPayload = {
  active_tasks: EngineeringTask[];
  completed_tasks: EngineeringTask[];
  failed_tasks: EngineeringTask[];
  needs_approval: EngineeringTask[];
  test_results: EngineeringTask[];
  system_health: {
    pending: number;
    in_progress: number;
    completed: number;
    failed: number;
    needs_approval: number;
    updated_at: string;
  };
  recent_logs: Array<{
    id: string;
    task_id: string | null;
    agent_type: string;
    level: string;
    message: string;
    created_at: string;
  }>;
  recent_patch_logs: Array<{
    id: string;
    task_id: string | null;
    agent: string;
    result: string;
    error: string | null;
    created_at: string;
  }>;
};

function formatIso(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function EngineeringDashboardPage() {
  const [data, setData] = useState<PanelPayload | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/engineering/panel", {
          cache: "no-store",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to load engineering panel");
        }

        const payload = (await response.json()) as PanelPayload;

        if (mounted) {
          setData(payload);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load engineering panel");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const summary = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      { label: "Pending", value: data.system_health.pending },
      { label: "In Progress", value: data.system_health.in_progress },
      { label: "Completed", value: data.system_health.completed },
      { label: "Failed", value: data.system_health.failed },
      { label: "Needs Approval", value: data.system_health.needs_approval },
    ];
  }, [data]);

  if (loading && !data) {
    return <main style={{ padding: 24 }}>Loading engineering panel...</main>;
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>AI Engineering Panel</h1>
      <p>Last updated: {formatIso(data?.system_health.updated_at || null)}</p>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {summary.map((item) => (
          <article key={item.label} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <strong>{item.label}</strong>
            <div style={{ fontSize: 24 }}>{item.value}</div>
          </article>
        ))}
      </section>

      <section>
        <h2>Active Agent Tasks</h2>
        <ul>
          {(data?.active_tasks || []).map((task) => (
            <li key={task.id}>
              {task.agent_type} | {task.task_type} | {task.status} | p{task.priority}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Completed Changes</h2>
        <ul>
          {(data?.completed_tasks || []).slice(0, 15).map((task) => (
            <li key={task.id}>
              {task.agent_type} | {task.task_type} | {formatIso(task.completed_at)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Test Results</h2>
        <ul>
          {(data?.test_results || []).slice(0, 15).map((task) => (
            <li key={task.id}>
              {task.task_type} | status: {task.status} | completed: {formatIso(task.completed_at)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Flagged For Approval</h2>
        <ul>
          {(data?.needs_approval || []).map((task) => (
            <li key={task.id}>
              {task.agent_type} | {task.task_type} | {task.error || "Awaiting approval"}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Recent Logs</h2>
        <ul>
          {(data?.recent_logs || []).slice(0, 20).map((log) => (
            <li key={log.id}>
              [{log.level}] {log.agent_type}: {log.message}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Patch Audit Log</h2>
        <ul>
          {(data?.recent_patch_logs || []).slice(0, 20).map((log) => (
            <li key={log.id}>
              [{log.result}] {log.agent} | task: {log.task_id || "-"} | {log.error || "ok"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
