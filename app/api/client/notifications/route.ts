import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isClientApiKeyValid, isUuid } from "@/lib/clients/clientApiAuth";

export async function GET(request: Request) {
  if (!isClientApiKeyValid(request)) {
    return NextResponse.json({ error: "Invalid client API key" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = String(searchParams.get("client_id") || "").trim();
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));

  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "client_id must be a valid uuid" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("client_notifications")
    .select("id, task_id, notification_type, priority, title, message, payload, is_read, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data || [] });
}

export async function PATCH(request: Request) {
  if (!isClientApiKeyValid(request)) {
    return NextResponse.json({ error: "Invalid client API key" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clientId = String(body?.client_id || "").trim();
  const notificationId = String(body?.notification_id || "").trim();

  if (!isUuid(clientId) || !isUuid(notificationId)) {
    return NextResponse.json({ error: "client_id and notification_id must be valid uuid values" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("client_notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("client_id", clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
