import { config as loadEnv } from "dotenv";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

type CompliancePayload = {
  user_id?: string;
  documents?: string[];
  country?: string;
};

export async function runComplianceWorker(payload: CompliancePayload) {
  const documents = payload.documents || [];

  const response = await executeModelRequest({
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
    telemetry: {
      module: "lib/compliance/complianceWorker.ts",
      userId: payload.user_id || null,
    },
  });

  const content = extractTextFromCompletion(response) || "{}";

  return {
    user_id: payload.user_id,
    documents,
    clean_ledger: content,
    vat_summary: content,
    tax_ready_report: content,
  };
}
