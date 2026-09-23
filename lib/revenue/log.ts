import { supabase } from "@/lib/supabase";

export async function logRevenue(amount: number, source: string, stream = "general") {
  await supabase.from("revenue").insert({
    amount,
    source,
    stream,
    created_at: new Date().toISOString(),
  });
}