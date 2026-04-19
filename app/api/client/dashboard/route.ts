import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getOrSetCache } from "@/lib/cache/performanceCache";
import { convertFromUsd, convertToUsd, normalizeCurrency } from "@/lib/billing/feeEngine";
import { calculateTaskFee } from "@/lib/billing/feeEngine";
import { isClientApiKeyValid, isUuid } from "@/lib/clients/clientApiAuth";

type WorkerTaskRow = {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  type: string | null;
  task_type: string | null;
  priority: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  payload: {
    country?: string;
    currency?: string;
    documents?: string[];
  } | null;
};

type InvoiceRow = {
  amount: number | string | null;
  amount_usd: number | string | null;
  status: string | null;
  currency: string | null;
};

function resolveTaskType(row: WorkerTaskRow) {
  return String(row.task_type || row.type || "").toUpperCase();
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function avgDeliveryMinutes(completed: WorkerTaskRow[]) {
  const durations = completed
    .map((row) => {
      const start = row.started_at || row.created_at;
      const end = row.completed_at;
      if (!start || !end) {
        return 0;
      }
      return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 60000);
    })
    .filter((value) => value > 0);

  if (durations.length === 0) {
    return 0;
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  return Math.round(total / durations.length);
}

export async function GET(request: Request) {
  if (!isClientApiKeyValid(request)) {
    return NextResponse.json({ error: "Invalid client API key" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = String(searchParams.get("client_id") || "").trim();

  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "client_id must be a valid uuid" }, { status: 400 });
  }

  const cacheKey = `client_dashboard:${clientId}`;

  const dashboard = await getOrSetCache(cacheKey, 15, async () => {
    const [tasksRes, invoicesRes, notificationsRes] = await Promise.all([
      supabaseServer
        .from("worker_tasks")
        .select("id, status, type, task_type, priority, created_at, started_at, completed_at, error, payload")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseServer
        .from("client_invoices")
        .select("amount, amount_usd, status, currency")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseServer
        .from("client_notifications")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("is_read", false),
    ]);

    if (tasksRes.error || invoicesRes.error || notificationsRes.error) {
      throw new Error(
        tasksRes.error?.message || invoicesRes.error?.message || notificationsRes.error?.message || "Failed to load dashboard"
      );
    }

    const tasks = (tasksRes.data || []) as WorkerTaskRow[];
    const invoices = (invoicesRes.data || []) as InvoiceRow[];

    const activeTasks = tasks.filter((task) => task.status === "pending" || task.status === "in_progress");
    const completedTasks = tasks.filter((task) => task.status === "completed");
    const flaggedExceptions = tasks.filter((task) => task.status === "failed" || Boolean(task.error));

    const estimatedCostUsd = activeTasks.reduce((sum, task) => {
      const taskType = resolveTaskType(task) as
        | "COMPLIANCE_TASK"
        | "BOOKKEEPING_TASK"
        | "DOCUMENT_PROCESSING"
        | "JOB_DISCOVERY"
        | "JOB_MATCHING"
        | "JOB_APPLICATION";
      const docCount = Array.isArray(task.payload?.documents) ? task.payload?.documents?.length || 0 : 0;
      const estimate = calculateTaskFee({
        taskType,
        country: task.payload?.country,
        documentCount: docCount,
        priority: Number(task.priority || 0),
        currency: task.payload?.currency || "USD",
      });

      return sum + estimate.amount_usd;
    }, 0);

    const paidRevenueUsd = invoices
      .filter((invoice) => String(invoice.status || "") === "paid")
      .reduce((sum, invoice) => sum + toNumber(invoice.amount_usd), 0);

    const totalInvoicedUsd = invoices.reduce((sum, invoice) => {
      if (invoice.amount_usd !== null && invoice.amount_usd !== undefined) {
        return sum + toNumber(invoice.amount_usd);
      }
      return sum + convertToUsd(toNumber(invoice.amount), invoice.currency || "USD");
    }, 0);

    const preferredCurrency = normalizeCurrency(
      String((invoices.find((invoice) => Boolean(invoice.currency))?.currency || "USD")).toUpperCase()
    );

    return {
      // Simplified top-level shape (camelCase)
      activeJobs: activeTasks,
      completedJobs: completedTasks,
      totalEarnings: Number(paidRevenueUsd.toFixed(2)),

      // Full detail (snake_case, preserved for backward compatibility)
      active_tasks: activeTasks,
      completed_tasks: completedTasks,
      flagged_exceptions: flaggedExceptions,
      unread_notifications: notificationsRes.count || 0,
      delivery_time_minutes_avg: avgDeliveryMinutes(completedTasks),
      estimated_cost: {
        currency: preferredCurrency,
        amount: convertFromUsd(estimatedCostUsd, preferredCurrency),
        amount_usd: Number(estimatedCostUsd.toFixed(2)),
      },
      revenue: {
        paid_amount_usd: Number(paidRevenueUsd.toFixed(2)),
        paid_amount: convertFromUsd(paidRevenueUsd, preferredCurrency),
        total_invoiced_usd: Number(totalInvoicedUsd.toFixed(2)),
        total_invoiced: convertFromUsd(totalInvoicedUsd, preferredCurrency),
        currency: preferredCurrency,
      },
      queue_status: {
        pending: activeTasks.filter((task) => task.status === "pending").length,
        in_progress: activeTasks.filter((task) => task.status === "in_progress").length,
        completed: completedTasks.length,
        failed: flaggedExceptions.length,
      },
      updated_at: new Date().toISOString(),
    };
  });

  return NextResponse.json(dashboard);
}
