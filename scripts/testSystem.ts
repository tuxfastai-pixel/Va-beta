import { updateJobProfitScores } from "@/lib/jobs/profitEngine";
import { autoApplyToJobs } from "@/lib/jobs/autoApplyEngine";
import { runReinforcementCycle } from "@/lib/growth/reinforcementEngine";

async function testSystem(userId: string) {
  await updateJobProfitScores();
  await autoApplyToJobs(userId);
  await runReinforcementCycle();

  console.log("System test complete");
}

const userId = process.argv[2];

if (!userId) {
  console.error("Usage: tsx scripts/testSystem.ts <userId>");
  process.exit(1);
}

testSystem(userId).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
});
