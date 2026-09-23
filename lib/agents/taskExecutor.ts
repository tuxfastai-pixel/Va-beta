import { config as loadEnv } from "dotenv";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

export async function executeTask(task: { description?: string }) {
  const response = await executeModelRequest({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You complete freelance tasks efficiently.",
      },
      {
        role: "user",
        content: task.description || "",
      },
    ],
    telemetry: {
      module: "lib/agents/taskExecutor.ts",
    },
  });

  return extractTextFromCompletion(response);
}
