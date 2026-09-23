import { getActiveUsers } from "@/lib/orchestrator/userLoader";
import { runUserCycle } from "@/lib/orchestrator/userCycle";

export async function runAutonomousLoop() {
  const users = await getActiveUsers();
  const results = [] as Array<{ userId: string; status: string; details?: unknown }>;

  for (const user of users) {
    if (user.system_paused) {
      results.push({ userId: user.id, status: "paused" });
      continue;
    }

    const details = await runUserCycle(user);
    results.push({ userId: user.id, status: "completed", details });
  }

  return {
    processed: results.length,
    results,
  };
}
