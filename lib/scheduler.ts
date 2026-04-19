import cron from "node-cron"
import { runDailyAgents } from "./agentLoop"
import { supabase } from "./supabase"

cron.schedule("0 8 * * *", async () => {
  const { data: users } = await supabase
    .from("profiles")
    .select("id")

  for (const user of users || []) {
    await runDailyAgents(user.id)
  }
})
