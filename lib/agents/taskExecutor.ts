import OpenAI from "openai";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function executeTask(task: { description?: string }) {
  const response = await openai.chat.completions.create({
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
  });

  return response.choices[0].message.content;
}
