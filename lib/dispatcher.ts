import { supabase } from "./supabase";

export async function enqueueTask(type: string, payload: Record<string, unknown> | string | number | boolean | null) {
  const taskType = String(type || "").toUpperCase();

  const { error } = await supabase.from("worker_tasks").insert({
    type: taskType,
    task_type: taskType,
    payload,
    status: "pending",
  });

  if (!error) {
    return;
  }

  const { error: fallbackError } = await supabase.from("worker_tasks").insert({
    type: taskType,
    payload,
    status: "pending",
  });

  if (fallbackError) {
    throw new Error(`Failed to enqueue task: ${fallbackError.message}`);
  }
}
