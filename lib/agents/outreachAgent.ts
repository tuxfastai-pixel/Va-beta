import OpenAI from "openai";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type OutreachProspect = {
  company_name?: string | null;
  industry?: string | null;
};

export async function generateOutreach(prospect: OutreachProspect) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You write professional business outreach emails.",
      },
      {
        role: "user",
        content: `
Write a short outreach email offering AI-assisted remote services.

Company:
${prospect.company_name}

Industry:
${prospect.industry}

Mention services like:
administration
CRM support
data management
marketing assistance
`,
      },
    ],
  });

  return response.choices[0].message.content;
}
