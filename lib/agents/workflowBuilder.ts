import OpenAI from "openai";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type WorkflowJob = {
  description?: string;
};

export async function buildWorkflow(job: WorkflowJob) {
  const response = await openai.chat.completions.create({
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
  });

  return response.choices[0].message.content;
}
