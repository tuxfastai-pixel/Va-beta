import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isClientApiKeyValid, isUuid } from "@/lib/clients/clientApiAuth";

export async function GET(request: Request) {
  if (!isClientApiKeyValid(request)) {
    return NextResponse.json({ error: "Invalid client API key" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = String(searchParams.get("client_id") || "").trim();

  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "client_id must be a valid uuid" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("client_invoices")
    .select("id, task_id, status, amount, amount_usd, currency, stripe_checkout_url, paypal_checkout_url, due_at, paid_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data || [] });
}
