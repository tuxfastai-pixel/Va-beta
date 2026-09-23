import { config as loadEnv } from "dotenv";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

export async function resumeAgent(resumeText: string) {
  const completion = await executeModelRequest({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You are a professional career coach improving resumes.",
      },
      {
        role: "user",
        content: resumeText,
      },
    ],
    telemetry: {
      module: "lib/agents/resumeAgent.ts",
    },
  });

  return extractTextFromCompletion(completion);
}
