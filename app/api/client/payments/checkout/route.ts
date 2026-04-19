import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isClientApiKeyValid, isUuid } from "@/lib/clients/clientApiAuth";

type Provider = "stripe" | "paypal";

function resolveCheckoutUrl(provider: Provider, invoice: {
  stripe_checkout_url?: string | null;
  paypal_checkout_url?: string | null;
}) {
  if (provider === "stripe") {
    return invoice.stripe_checkout_url || null;
  }
  return invoice.paypal_checkout_url || null;
}

export async function POST(request: Request) {
  if (!isClientApiKeyValid(request)) {
    return NextResponse.json({ error: "Invalid client API key" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clientId = String(body?.client_id || "").trim();
  const invoiceId = String(body?.invoice_id || "").trim();
  const provider = String(body?.provider || "").trim().toLowerCase() as Provider;

  if (!isUuid(clientId) || !isUuid(invoiceId)) {
    return NextResponse.json({ error: "client_id and invoice_id must be valid uuid values" }, { status: 400 });
  }

  if (provider !== "stripe" && provider !== "paypal") {
    return NextResponse.json({ error: "provider must be stripe or paypal" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("client_invoices")
    .select("id, stripe_checkout_url, paypal_checkout_url, status")
    .eq("id", invoiceId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const checkoutUrl = resolveCheckoutUrl(provider, data);

  if (!checkoutUrl) {
    return NextResponse.json(
      { error: `${provider} checkout is not configured` },
      { status: 501 }
    );
  }

  const { error: updateError } = await supabaseServer
    .from("client_invoices")
    .update({ payment_provider: provider })
    .eq("id", invoiceId)
    .eq("client_id", clientId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "ready",
    invoice_id: invoiceId,
    provider,
    checkout_url: checkoutUrl,
  });
}
