import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildPaymentLinks } from "@/lib/billing/paymentLinks";
import { calculateDynamicPrice, generateProposalTemplate } from "@/lib/agents/applicationAgent";
import { trackFunnelEvent } from "@/lib/analytics/funnelTracking";

type IntakeBody = {
  email?: string;
  client_id?: string;
  company?: string;
  task?: string;
  title?: string;
  description?: string;
  recommendation?: string;
  pay_amount?: number;
  match_score?: number;
  quality_score?: number;
  currency?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

async function resolveClientId(body: IntakeBody): Promise<{ clientId?: string; error?: string }> {
  const providedClientId = String(body.client_id || "").trim();
  if (providedClientId) {
    if (!isUuid(providedClientId)) {
      return { error: "client_id must be a valid uuid" };
    }
    return { clientId: providedClientId };
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email) {
    return { error: "email is required to resolve client_id" };
  }

  const { data: existingClient, error: existingClientErr } = await supabaseServer
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingClientErr) {
    return { error: `Failed to resolve client: ${existingClientErr.message}` };
  }

  if (existingClient?.id) {
    return { clientId: String(existingClient.id) };
  }

  const displayName = String(body.company || email.split("@")[0] || "Client").trim();
  const { data: createdClient, error: createClientErr } = await supabaseServer
    .from("clients")
    .insert({
      email,
      name: displayName,
      subscription_type: "starter",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createClientErr) {
    return { error: `Failed to create client: ${createClientErr.message}` };
  }

  return { clientId: String(createdClient.id) };
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCurrency(value: unknown): "USD" | "GBP" | "EUR" | "AED" {
  const normalized = String(value || "USD").trim().toUpperCase();
  if (normalized === "GBP" || normalized === "EUR" || normalized === "AED") {
    return normalized;
  }
  return "USD";
}

function validate(body: IntakeBody) {
  const email = String(body.email || "").trim();
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();

  if (!email || !email.includes("@")) return "email is required";
  if (!title) return "title is required";
  if (!description) return "description is required";

  return null;
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/intake",
    methods: ["GET", "POST"],
    required_fields: ["email", "title", "description"],
    optional_fields: [
      "company",
      "recommendation",
      "pay_amount",
      "match_score",
      "quality_score",
      "currency",
    ],
    sample_request: {
      email: "client@example.com",
      company: "Acme Inc",
      title: "Automate reporting workflow",
      description: "Need daily report automation from multiple sources",
      recommendation: "- build ingestion + dashboard + alerts",
      pay_amount: 120,
      match_score: 90,
      quality_score: 80,
      currency: "USD",
    },
  });
}

export async function POST(request: Request) {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  let body: IntakeBody | null = null;

  if (contentType.includes("application/json")) {
    body = (await request.json().catch(() => null)) as IntakeBody | null;
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData().catch(() => null);
    if (form) {
      const task = String(form.get("task") || "").trim();
      body = {
        email: String(form.get("email") || ""),
        company: String(form.get("company") || ""),
        task,
        title: String(form.get("title") || task),
        description: String(form.get("description") || task),
        recommendation: String(form.get("recommendation") || ""),
        pay_amount: Number(form.get("pay_amount") || "0") || undefined,
        match_score: Number(form.get("match_score") || "0") || undefined,
        quality_score: Number(form.get("quality_score") || "0") || undefined,
        currency: String(form.get("currency") || "USD"),
      };
    }
  } else {
    body = (await request.json().catch(() => null)) as IntakeBody | null;
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = {
    id: "intake-preview",
    company: String(body.company || "there"),
    title: String(body.title || ""),
    description: String(body.description || ""),
    recommendation: String(body.recommendation || "").trim() || "- deliver a complete solution efficiently",
    pay_amount: asNumber(body.pay_amount, 50),
    match_score: asNumber(body.match_score, 85),
    quality_score: asNumber(body.quality_score, 70),
    currency: normalizeCurrency(body.currency),
    scam_risk: "low",
  };

  const proposal = generateProposalTemplate(payload);
  const calculatedAmount = calculateDynamicPrice(payload);

  const { clientId, error: clientResolveErr } = await resolveClientId(body);
  if (clientResolveErr || !clientId) {
    return NextResponse.json({ error: clientResolveErr || "Failed to resolve client_id" }, { status: 400 });
  }

  const { data: jobRow, error: jobErr } = await supabaseServer
    .from("jobs")
    .insert({
      title: payload.title,
      company: payload.company,
      description: payload.description,
      recommendation: payload.recommendation,
      pay_amount: payload.pay_amount,
      match_score: payload.match_score,
      quality_score: payload.quality_score,
      currency: payload.currency,
      scam_risk: payload.scam_risk,
    })
    .select("id")
    .single();

  if (jobErr) {
    return NextResponse.json({ error: `Failed to create job: ${jobErr.message}` }, { status: 500 });
  }

  const { data: invoiceRow, error: invoiceErr } = await supabaseServer
    .from("invoices")
    .insert({
      client_id: clientId,
      task_id: jobRow.id,
      amount: calculatedAmount,
      currency: payload.currency,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (invoiceErr) {
    return NextResponse.json({ error: `Failed to create invoice: ${invoiceErr.message}` }, { status: 500 });
  }

  const paymentLinks = buildPaymentLinks({
    invoiceId: String(invoiceRow.id),
    amount: calculatedAmount,
    currency: payload.currency,
    clientId,
  });

  const { error: outreachErr } = await supabaseServer.from("outreach_logs").insert({
    email: String(body.email || ""),
    subject: `Proposal for ${payload.title}`,
    message: proposal,
    status: "generated",
  });

  if (outreachErr) {
    return NextResponse.json({ error: `Job + invoice created but failed to log outreach: ${outreachErr.message}` }, { status: 500 });
  }

  // Track funnel event: lead created
  await trackFunnelEvent({
    email: String(body.email || ""),
    step: "lead_created",
    metadata: {
      jobId: jobRow.id,
      invoiceId: invoiceRow.id,
      clientId,
      title: payload.title,
    },
  });

  return NextResponse.json({
    status: "accepted",
    jobId: jobRow.id,
    invoiceId: invoiceRow.id,
    amount: calculatedAmount,
    currency: payload.currency,
    proposal,
    paymentLink: paymentLinks.paypal_checkout_url,
    paymentLinks,
  });
}
