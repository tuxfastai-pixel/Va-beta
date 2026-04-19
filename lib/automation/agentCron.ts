import cron from "node-cron";
import { supabaseServer } from "@/lib/supabaseServer";
import { runLinkedInAgent, type LinkedInSessionState } from "@/lib/agents/linkedinAgent";
import { runDailyReinforcementMutation, runReinforcementCycle } from "@/lib/growth/reinforcementEngine";
import { updateJobProfitScores } from "@/lib/jobs/profitEngine";
import { autoApplyToJobs } from "@/lib/jobs/autoApplyEngine";

const BASE_URL = process.env.AUTOMATION_BASE_URL || "http://localhost:3000";
const SAFE_MODE = String(process.env.SAFE_MODE || "true") === "true";
export const AUTONOMOUS_MODE = String(process.env.AUTONOMOUS_MODE || "false") === "true";

async function logRun(type: string) {
  await supabaseServer.from("system_logs").insert({ type });
}

let executions = 0;
const MAX_EXECUTIONS = Number(process.env.MAX_AUTONOMOUS_EXECUTIONS || 20);

async function trigger(path: string) {
  if (SAFE_MODE) {
    console.log(`[SAFE_MODE] Preview only: ${path}`);
    return;
  }

  await fetch(`${BASE_URL}${path}`, { method: "POST" });
}

export async function autonomousLoop() {
  if (!AUTONOMOUS_MODE) {
    return;
  }

  if (executions >= MAX_EXECUTIONS) {
    console.log("Limit reached");
    return;
  }

  await trigger("/api/agent/scraper/run");
  await trigger("/api/agent/linkedin/run");
  await trigger("/api/agent/negotiation/run");
  await trigger("/api/orchestrator/run?autonomous=true&autoApply=false");

  const { data: accounts, error: accountErr } = await supabaseServer
    .from("agent_accounts")
    .select("id, session_data, status")
    .eq("status", "active")
    .limit(20);

  if (accountErr) {
    console.log(`Failed to load agent accounts: ${accountErr.message}`);
  } else {
    type AgentAccountRow = {
      id: string;
      session_data?: LinkedInSessionState | string | null;
      status: string;
    };

    for (const acc of (accounts || []) as AgentAccountRow[]) {
      await runLinkedInAgent(acc.session_data ?? undefined);
    }
  }

  executions += 1;
  console.log("Autonomous cycle complete");
}

export function startAgentAutomation() {
  // Scraper: every 30 mins
  cron.schedule("*/30 * * * *", async () => {
    await trigger("/api/agent/scraper/run");
  });

  // Negotiation: every 10 mins
  cron.schedule("*/10 * * * *", async () => {
    await trigger("/api/agent/negotiation/run");
  });

  // LinkedIn: 2 times/day (09:00 and 17:00)
  cron.schedule("0 9,17 * * *", async () => {
    await trigger("/api/agent/linkedin/run");
  });

  // Full autonomous cycle
  cron.schedule("*/20 * * * *", autonomousLoop);

  // Revenue orchestrator loop: every 10 mins
  cron.schedule("*/10 * * * *", async () => {
    await trigger("/api/orchestrator/run?autonomous=true&autoApply=false");
  });

  // Reinforcement learning cycle: every hour
  cron.schedule("0 * * * *", async () => {
    try {
      await runReinforcementCycle();
      await logRun("rl");
    } catch (error) {
      console.log(`Reinforcement cycle failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  // Profit scoring: every hour
  cron.schedule("0 * * * *", async () => {
    try {
      await updateJobProfitScores();
      await logRun("scoring");
    } catch (error) {
      console.log(`Profit scoring failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  // Auto apply: every 2 hours
  cron.schedule("0 */2 * * *", async () => {
    try {
      const { data: rows, error } = await supabaseServer
        .from("job_matches")
        .select("user_id")
        .not("user_id", "is", null)
        .limit(200);

      if (error) {
        throw new Error(error.message);
      }

      const uniqueUserIds = Array.from(new Set((rows || []).map((r) => String(r.user_id)).filter(Boolean)));

      for (const userId of uniqueUserIds) {
        await autoApplyToJobs(userId);
      }
      await logRun("apply");
    } catch (error) {
      console.log(`Auto apply cycle failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  // Daily reinforcement mutation for weak templates
  cron.schedule("0 2 * * *", async () => {
    try {
      await runDailyReinforcementMutation();
    } catch (error) {
      console.log(`Daily reinforcement mutation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });
}
