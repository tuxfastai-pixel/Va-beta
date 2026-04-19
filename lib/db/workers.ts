import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getWorkers() {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .limit(50);

  if (error) {
    throw error;
  }

  return (data || []).map((user) => ({
    worker_name: `${String(user.id).split("@")[0]}Worker`,
    user_id: user.id,
    email: null,
    markets: ["US", "UK", "DE", "FR", "NL", "UAE"],
    resume: "",
    profile: "",
  }));
}
