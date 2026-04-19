import { supabase } from "@/lib/supabase";

export async function enqueueEngineeringTask(payload: Record<string, unknown>, priority = 2): Promise<void> {
  const { error } = await supabase.from("engineering_tasks").insert({
    task_type: "JOB_MATCH_AUTOMATION",
    agent_type: "PLANNER",
    payload,
    priority,
  });

  if (error) {
    throw new Error(`Failed to enqueue engineering task: ${error.message}`);
  }
}
