import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

export async function workflowAgent(jobDescription: string) {
  const completion = await executeModelRequest({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You design automated workflows for remote jobs.",
      },
      {
        role: "user",
        content: `
Job Description:
${jobDescription}

Return list of tasks with:
- task name
- automation level (AI / Human / Hybrid)
`,
      },
    ],
    telemetry: {
      module: "lib/agents/workflowAgent.ts",
    },
  });

  return extractTextFromCompletion(completion);
}
