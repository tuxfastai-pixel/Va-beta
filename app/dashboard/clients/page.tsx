"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DashboardPayload = {
  active_tasks: Array<{ id: string; task_type?: string; type?: string; status: string }>;
  completed_tasks: Array<{ id: string; task_type?: string; type?: string; completed_at?: string }>;
  flagged_exceptions: Array<{ id: string; error?: string | null }>;
  delivery_time_minutes_avg: number;
  estimated_cost: { amount: number; amount_usd: number; currency: string };
  revenue: {
    paid_amount: number;
    paid_amount_usd: number;
    total_invoiced: number;
    total_invoiced_usd: number;
    currency: string;
  };
  unread_notifications: number;
};

export default function ClientsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_CLIENT_API_KEY || "";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const { data: authData } = await supabase.auth.getUser();
      const clientId = authData?.user?.id;

      if (!clientId) {
        setError("Client session is required.");
        setLoading(false);
        return;
      }

      if (!apiKey) {
        setError("NEXT_PUBLIC_CLIENT_API_KEY is not configured.");
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/client/dashboard?client_id=${clientId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(String(payload?.error || "Failed to load dashboard."));
        setLoading(false);
        return;
      }

      setData(payload as DashboardPayload);
      setLoading(false);
    }

    void load();
  }, [apiKey]);

  const costLabel = useMemo(() => {
    if (!data) {
      return "-";
    }

    return `${data.estimated_cost.currency} ${data.estimated_cost.amount.toFixed(2)} (USD ${data.estimated_cost.amount_usd.toFixed(2)})`;
  }, [data]);

  const revenueLabel = useMemo(() => {
    if (!data) {
      return "-";
    }

    return `${data.revenue.currency} ${data.revenue.total_invoiced.toFixed(2)} (USD ${data.revenue.total_invoiced_usd.toFixed(2)})`;
  }, [data]);

  if (loading) {
    return <div className="p-8">Loading client dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Client Operations Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl shadow bg-white p-5">
          <h2 className="font-semibold">Active tasks</h2>
          <p className="text-2xl mt-2">{data?.active_tasks.length || 0}</p>
        </div>
        <div className="rounded-xl shadow bg-white p-5">
          <h2 className="font-semibold">Completed tasks</h2>
          <p className="text-2xl mt-2">{data?.completed_tasks.length || 0}</p>
        </div>
        <div className="rounded-xl shadow bg-white p-5">
          <h2 className="font-semibold">Flagged exceptions</h2>
          <p className="text-2xl mt-2">{data?.flagged_exceptions.length || 0}</p>
        </div>
        <div className="rounded-xl shadow bg-white p-5">
          <h2 className="font-semibold">Estimated cost</h2>
          <p className="text-sm mt-2">{costLabel}</p>
        </div>
        <div className="rounded-xl shadow bg-white p-5">
          <h2 className="font-semibold">Estimated revenue</h2>
          <p className="text-sm mt-2">{revenueLabel}</p>
        </div>
        <div className="rounded-xl shadow bg-white p-5">
          <h2 className="font-semibold">Avg delivery time</h2>
          <p className="text-2xl mt-2">{data?.delivery_time_minutes_avg || 0} min</p>
          <p className="text-xs mt-1">Unread notifications: {data?.unread_notifications || 0}</p>
        </div>
      </div>

      <div className="rounded-xl shadow bg-white p-5">
        <h2 className="font-semibold mb-3">Recent active tasks</h2>
        {(data?.active_tasks || []).length === 0 ? (
          <p>No active tasks.</p>
        ) : (
          <div className="space-y-2">
            {(data?.active_tasks || []).slice(0, 8).map((task) => (
              <div key={task.id} className="border rounded p-3">
                <p>Task: {task.id}</p>
                <p>Type: {(task.task_type || task.type || "unknown").toString()}</p>
                <p>Status: {task.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
