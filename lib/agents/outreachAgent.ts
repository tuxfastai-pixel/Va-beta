import { config as loadEnv } from "dotenv";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

type OutreachProspect = {
  company_name?: string | null;
  industry?: string | null;
};

export async function generateOutreach(prospect: OutreachProspect) {
  const response = await executeModelRequest({
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
    telemetry: {
      module: "lib/agents/outreachAgent.ts",
    },
  });

  return extractTextFromCompletion(response);
}
