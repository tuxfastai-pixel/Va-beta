import { config as loadEnv } from "dotenv";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

type WorkflowJob = {
  description?: string;
};

export async function buildWorkflow(job: WorkflowJob) {
  const response = await executeModelRequest({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "Convert jobs into structured workflows.",
      },
      {
        role: "user",
        content: `Job Description:\n\n${job.description || ""}\n\nReturn tasks list.`,
      },
    ],
    telemetry: {
      module: "lib/agents/workflowBuilder.ts",
    },
  });

  return extractTextFromCompletion(response);
}
