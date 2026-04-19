import { plannerAgent } from "../lib/agents/plannerAgent.ts";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables for autonomous loop.");
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);

console.log("Autonomous career loop started...");

async function runDiscovery() {
  console.log("Running autonomous job discovery...");

  const { data: users } = await supabase
    .from("users")
    .select("id, resume, profile")
    .limit(10);

  if (!users) return;

  for (const user of users) {
    await plannerAgent(
      user.id,
      user.resume,
      user.profile
    );
  }
}

async function runRanking() {
  console.log("Running ranking engine...");
}

async function runApplications() {
  console.log("Running application agent...");
}

async function runWorkflowAutomation() {
  console.log("Running workflow automation...");
}

setInterval(runDiscovery, 3 * 60 * 60 * 1000);

setInterval(runRanking, 3 * 60 * 60 * 1000);

setInterval(runApplications, 6 * 60 * 60 * 1000);

setInterval(runWorkflowAutomation, 30 * 60 * 1000);

void runDiscovery();
void runRanking();
void runApplications();
void runWorkflowAutomation();

setInterval(() => {
  // Keep process alive between scheduled runs.
}, 60 * 60 * 1000);
