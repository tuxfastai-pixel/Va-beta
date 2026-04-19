import OpenAI from "openai";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CompliancePayload = {
  user_id?: string;
  documents?: string[];
  country?: string;
};

export async function runComplianceWorker(payload: CompliancePayload) {
  const documents = payload.documents || [];

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a financial compliance assistant. Perform document extraction, transaction categorization, reconciliation, and reporting.",
      },
      {
        role: "user",
        content: `Country: ${payload.country || "Unknown"}\nDocuments: ${documents.join(", ")}\n\nReturn JSON with:\n- clean_ledger\n- vat_summary\n- tax_ready_report`,
      },
    ],
  });

  const content = response.choices[0].message.content || "{}";

  return {
    user_id: payload.user_id,
    documents,
    clean_ledger: content,
    vat_summary: content,
    tax_ready_report: content,
  };
}
