import { agentQueue } from "./queue"

export async function runDailyAgents(userId: string) {
  if (!agentQueue) {
    console.log("⚠️ Redis not configured — skipping daily agents");
    return;
  }

  await agentQueue.add("training", {
    type: "dailyTraining",
    userId
  })

  await agentQueue.add("jobs", {
    type: "jobScan",
    userId
  })

  await agentQueue.add("progress", {
    type: "progressUpdate",
    userId
  })
}
