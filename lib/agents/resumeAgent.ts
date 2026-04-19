import OpenAI from "openai";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function resumeAgent(resumeText: string) {
  const completion = await client.chat.completions.create({
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
  });

  return completion.choices[0].message.content;
}
