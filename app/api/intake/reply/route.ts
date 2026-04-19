import { createHash } from "crypto";
import { generateClosingReply } from "@/lib/agents/closingAgent";
import { CLIENT_TRANSPARENCY_NOTE, proposalTemplate } from "@/lib/ai/outputQuality";
import { detectNegotiationScenario, generateNegotiationReply } from "@/lib/negotiation/negotiationEngine";
import { createInvoiceRecord } from "@/lib/payments/invoiceGenerator";
import { generatePaymentLink, selectPaymentMethod } from "@/lib/payments/paymentIntelligence";
import { supabaseServer } from "@/lib/supabaseServer";
import { recordSkillPractice } from "@/lib/skills/progressEngine";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function stableUuidFromString(raw: string): string {
  const hex = createHash("sha1").update(raw).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizeToUuid(value: unknown, fallbackSeed: string): string {
  const text = String(value || "").trim();
  if (isUuid(text)) {
    return text;
  }
  return stableUuidFromString(text || fallbackSeed);
}

function makeSyntheticEmail(userId: string): string {
  const local = userId.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 40) || "client";
  return `${local}@autoclient.local`;
}

async function resolveClientIdForClosing(input: {
  explicitClientId?: unknown;
  explicitEmail?: unknown;
  userIdSeed: string;
  company?: unknown;
}): Promise<{ clientId?: string; error?: string }> {
  const providedClientId = String(input.explicitClientId || "").trim();
  if (providedClientId) {
    if (!isUuid(providedClientId)) {
      return { error: "client_id must be a valid uuid" };
    }
    return { clientId: providedClientId };
  }

  const providedEmail = String(input.explicitEmail || "").trim().toLowerCase();
  const lookupEmail = providedEmail || makeSyntheticEmail(input.userIdSeed);

  const { data: existingClient, error: existingClientErr } = await supabaseServer
    .from("clients")
    .select("id")
    .eq("email", lookupEmail)
    .maybeSingle();

  if (existingClientErr) {
    return { error: `Failed to resolve client: ${existingClientErr.message}` };
  }

  if (existingClient?.id) {
    return { clientId: String(existingClient.id) };
  }

  const name = String(input.company || input.userIdSeed || "Client").trim();
  const { data: createdClient, error: createdClientErr } = await supabaseServer
    .from("clients")
    .insert({
      email: lookupEmail,
      name,
      subscription_type: "starter",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createdClientErr) {
    return { error: `Failed to create client: ${createdClientErr.message}` };
  }

  return { clientId: String(createdClient.id) };
}

function mapScenarioToStage(scenario: string): string {
  switch (scenario) {
    case "price_push":
    case "comparison":
    case "competition":
      return "negotiating";
    case "ready_to_close":
      return "closed";
    case "hesitation":
    default:
      return "replied";
  }
}

const LICENSE_OFFER = [
  "We provide an AI-powered execution system that:",
  "",
  "• automates development workflows",
  "• handles repetitive engineering tasks",
  "• improves delivery speed",
  "",
  "We license this system to companies looking to scale output without increasing headcount.",
  "",
  "We can start with a pilot and expand based on results.",
].join("\n");

export async function POST(req: Request) {
  const body = await req.json();
  const { message, job, userId, license, client_id, email, country, company_size, origin } = body;

  // 🔒 License gate — no license, no access.
  if (!license?.active) {
    return new Response("License inactive", { status: 403 });
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (!userId || !job?.id) {
    return Response.json({ error: "userId and job.id are required" }, { status: 400 });
  }

  const scenario = detectNegotiationScenario(message);
  const stage = mapScenarioToStage(scenario);

  const normalizedUserId = normalizeToUuid(userId, `user:${String(userId || "unknown")}`);
  const normalizedJobId = normalizeToUuid(job?.id, `job:${String(job?.id || "unknown")}`);
  const amount = Number(job?.pay_amount || 0);
  const currency = String(job?.currency || "USD").toUpperCase();

  const { clientId, error: resolveClientError } = await resolveClientIdForClosing({
    explicitClientId: client_id ?? job?.client_id,
    explicitEmail: email ?? job?.email,
    userIdSeed: String(userId),
    company: job?.company,
  });

  if (resolveClientError || !clientId) {
    return Response.json({ error: resolveClientError || "Failed to resolve client_id" }, { status: 400 });
  }

  const negotiationReply = generateNegotiationReply(scenario, job || {});
  const fallbackClosingReply = generateClosingReply(scenario === "competition" ? "comparison" : "hesitation", job || {});
  const baseReply = String(negotiationReply || "").trim() || String(fallbackClosingReply || "").trim();
  const reply = proposalTemplate({
    summary: String(job?.title || "your requirement").trim(),
    solution: [baseReply, LICENSE_OFFER, CLIENT_TRANSPARENCY_NOTE].filter(Boolean).join("\n\n"),
    timeline: stage === "closed"
      ? "Ready to start immediately after confirmation."
      : "Flexible and ready to begin as soon as we align on the next step.",
    rate: amount > 0 ? `${currency} ${amount.toFixed(2)}` : "Flexible based on scope",
  });

  // Single upsert that handles the full pipeline state transition.
  const upsertRes = await supabaseServer.from("deals").upsert(
    {
      user_id: normalizedUserId,
      job_id: normalizedJobId,
      status: stage,
      stage,
      last_message: message,
      value: amount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job_id" }
  );

  if (upsertRes.error) {
    return Response.json({ error: upsertRes.error.message }, { status: 500 });
  }

  try {
    await createInvoiceRecord({
      clientId,
      taskId: normalizedJobId,
      amount,
      currency,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    return Response.json({ error: message }, { status: 500 });
  }

  const earningsRes = await supabaseServer.from("earnings").insert({
    user_id: normalizedUserId,
    client_id: clientId,
    job_id: normalizedJobId,
    amount,
    currency,
    status: stage === "closed" ? "recorded" : "pending",
    created_at: new Date().toISOString(),
  });

  if (earningsRes.error) {
    return Response.json({ error: earningsRes.error.message }, { status: 500 });
  }

  const memoryContent = [
    `Client reply: ${String(message).trim()}`,
    `Scenario: ${scenario}`,
    `Stage: ${stage}`,
    `Job: ${String(job?.title || "Untitled")}`,
  ].join(" | ");

  let memoryRes = await supabaseServer.from("ai_memory").insert({
    user_id: normalizedUserId,
    memory_type: "closing",
    content: memoryContent,
    context: {
      external_user_id: String(userId),
      external_job_id: String(job?.id),
    },
    created_at: new Date().toISOString(),
  });

  if (memoryRes.error && memoryRes.error.message.includes("ai_memory_user_id_fkey")) {
    memoryRes = await supabaseServer.from("ai_memory").insert({
      memory_type: "closing",
      content: memoryContent,
      context: {
        external_user_id: String(userId),
        external_job_id: String(job?.id),
      },
      created_at: new Date().toISOString(),
    });
  }

  if (memoryRes.error) {
    return Response.json({ error: memoryRes.error.message }, { status: 500 });
  }

  const workerTaskRes = await supabaseServer.from("worker_tasks").insert({
    task_type: "EXECUTION_OPTIMIZATION",
    agent_type: "execution",
    status: "pending",
    priority: stage === "closed" ? 10 : 5,
    payload: {
      user_id: normalizedUserId,
      client_id: clientId,
      job_id: normalizedJobId,
      stage,
      scenario,
      amount,
      currency,
    },
    context: {
      source: "api/intake/reply",
      external_user_id: String(userId),
      external_job_id: String(job?.id),
    },
    created_at: new Date().toISOString(),
  });

  if (workerTaskRes.error) {
    return Response.json({ error: workerTaskRes.error.message }, { status: 500 });
  }

  let skillProgressWarning: string | undefined;
  try {
    await recordSkillPractice({
      userId: normalizedUserId,
      skill: stage === "closed" ? "proposal closing" : "client negotiation",
      usage: stage === "closed" ? 10 : 6,
      aiSupported: true,
    });
  } catch (error) {
    skillProgressWarning = error instanceof Error ? error.message : "Failed to record skill progress.";
  }

  let paymentMethod: "paystack" | "paypal" | "bank" | null = null;
  let paymentLink: string | null = null;

  if (stage === "closed") {
    const clientProfile = {
      email: String(email || "").trim() || undefined,
      country: String(country || "").trim() || undefined,
      company_size: ["individual", "small", "enterprise"].includes(String(company_size || "").toLowerCase())
        ? (String(company_size).toLowerCase() as "individual" | "small" | "enterprise")
        : undefined,
      budget: Number(job?.budget || amount),
    };

    paymentMethod = selectPaymentMethod(clientProfile);

    if (paymentMethod !== "bank") {
      paymentLink = await generatePaymentLink({
        method: paymentMethod,
        amount: Number(job?.budget || amount || 100),
        currency,
        email: String(email || "").trim(),
        job_id: normalizedJobId,
        user_id: normalizedUserId,
        origin: String(origin || "").trim() || undefined,
      });
    }

    const paymentDecisionInsert = await supabaseServer.from("payments").insert({
      user_id: normalizedUserId,
      client_id: clientId,
      job_id: normalizedJobId,
      method: paymentMethod,
      amount: Number(job?.budget || amount || 0),
      status: "pending",
      payment_link: paymentLink,
      follow_up_stage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const paymentDecisionError = paymentDecisionInsert.error?.message?.toLowerCase() || "";
    const isMissingPaymentsTable =
      paymentDecisionError.includes("relation \"payments\" does not exist") ||
      paymentDecisionError.includes("could not find the table 'public.payments'");

    if (paymentDecisionInsert.error && !isMissingPaymentsTable) {
      return Response.json({ error: paymentDecisionInsert.error.message }, { status: 500 });
    }
  }

  if (stage === "closed" && paymentMethod === "bank") {
    return Response.json({
      scenario,
      stage,
      userId: normalizedUserId,
      jobId: normalizedJobId,
      clientId,
      amount,
      currency,
      payment_method: "bank",
      warning: skillProgressWarning,
      reply: "For this project, we use bank transfer. Please confirm and I will send an official invoice with banking details.",
    });
  }

  if (stage === "closed" && paymentMethod && paymentLink) {
    return Response.json({
      scenario,
      stage,
      userId: normalizedUserId,
      jobId: normalizedJobId,
      clientId,
      amount,
      currency,
      payment_method: paymentMethod,
      payment_link: paymentLink,
      warning: skillProgressWarning,
      reply: `Great - I have prepared everything for you. You can complete payment securely here: ${paymentLink}`,
    });
  }

  return Response.json({
    scenario,
    stage,
    userId: normalizedUserId,
    jobId: normalizedJobId,
    clientId,
    amount,
    currency,
    warning: skillProgressWarning,
    reply: reply.trim(),
  });
}
