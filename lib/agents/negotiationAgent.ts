import { config as loadEnv } from "dotenv";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

type NegotiationJob = {
  salary?: string | number | null;
  pay_amount?: string | number | null;
};

export async function generateNegotiation(job: NegotiationJob) {
  const response = await executeModelRequest({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You negotiate freelance job rates professionally.",
      },
      {
        role: "user",
        content: `Client offered: ${job.salary || job.pay_amount || "N/A"}\n\nGenerate negotiation message asking for higher pay.`,
      },
    ],
    telemetry: {
      module: "lib/agents/negotiationAgent.ts",
    },
  });

  return extractTextFromCompletion(response);
}

type ReplyContext = {
  clientMessage: string;
  job?: NegotiationJob;
};

type LeadContext = {
  replied?: boolean;
  message?: string;
  job?: NegotiationJob;
};

export function generateReply(context: ReplyContext) {
  const msg = String(context.clientMessage || "").toLowerCase();

  if (msg.includes("price")) {
    return [
      "We price based on outcome and speed.",
      "",
      "For this task, we can deliver efficiently with high quality.",
      "",
      "If you'd like, we can start with a smaller milestone to demonstrate value.",
    ].join("\n");
  }

  if (msg.includes("not sure")) {
    return [
      "Totally understand.",
      "",
      "We can start with a small scoped version of the task so you can evaluate",
      "the results before committing further.",
    ].join("\n");
  }

  return [
    "Happy to proceed and get started immediately.",
    "",
    "Let me know if you'd like me to begin.",
  ].join("\n");
}

// small commitment -> trust -> larger contract
export async function runAutoClosingFlow(
  lead: LeadContext,
  sendMessage: (reply: string) => Promise<void> | void
) {
  if (!lead.replied) {
    return;
  }

  const reply = generateReply({
    clientMessage: String(lead.message || ""),
    job: lead.job,
  });

  await sendMessage(reply);
}
