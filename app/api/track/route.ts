import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const data = (await req.json().catch(() => ({}))) as {
    event?: string;
    source?: string;
    email?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };

  const event = String(data.event || "unknown");
  const source = String(data.source || "direct");

  console.log("TRACK:", { event, source, metadata: data.metadata || {} });

  try {
    await supabaseServer.from("funnel_events").insert({
      user_id: data.userId || null,
      email: data.email || null,
      step: event,
      metadata: {
        source,
        ...(data.metadata || {}),
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    // Swallow analytics persistence errors to keep tracking endpoint resilient.
  }

  return NextResponse.json({ ok: true });
}
