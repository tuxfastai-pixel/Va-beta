import { supabaseServer } from "@/lib/supabaseServer";

function isMissingActivityTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("ai_activity_logs") && message.includes("could not find the table");
}

export async function logAIActivity(input: {
  userId?: string | null;
  action: string;
  aiUsed?: boolean;
}) {
  const { error } = await supabaseServer.from("ai_activity_logs").insert({
    user_id: input.userId || null,
    action: input.action,
    ai_used: input.aiUsed ?? true,
    created_at: new Date().toISOString(),
  });

  if (error && !isMissingActivityTable(error)) {
    console.error(`Failed to log AI activity: ${error.message}`);
  }

  return { logged: !error };
}
