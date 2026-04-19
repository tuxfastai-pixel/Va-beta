import { supabaseServer } from "@/lib/supabaseServer";

export type AiMode = "assist" | "autonomous";

export async function getUserMode(userId: string): Promise<AiMode> {
  const { data, error } = await supabaseServer
    .from("users")
    .select("ai_mode")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.ai_mode) {
    return "assist";
  }

  return data.ai_mode === "autonomous" ? "autonomous" : "assist";
}

export async function setUserMode(userId: string, mode: AiMode) {
  await supabaseServer.from("users").update({ ai_mode: mode }).eq("id", userId);
}