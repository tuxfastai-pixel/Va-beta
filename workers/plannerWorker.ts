import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { runPlanner } from "../lib/agents/plannerAgent.ts";
import { logSystemStatus } from "../lib/system/health.ts";

loadEnv({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables for planner worker.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function getActiveUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, preferred_markets")
    .limit(50);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function plannerLoop() {
  const users = await getActiveUsers();

  for (const user of users) {
    await runPlanner(user);
  }

  logSystemStatus({
    worker: "planner",
    checkedUsers: users.length,
    timestamp: new Date().toISOString(),
  });
}

void plannerLoop();

setInterval(() => {
  void plannerLoop();
}, 60 * 60 * 1000);
