import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { qualifyLead } from "@/lib/ai/qualification";
import { upsertLead } from "@/lib/crm/leadStore";
import { routeLead } from "@/lib/ai/router";
import { trackFunnelEvent } from "@/lib/analytics/funnelTracking";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const payload = await req.json();

  const lead = {
    name: payload.name || "Unknown",
    email: payload.email || null,
    phone: payload.phone || null,
    message: payload.message || "",
    source: payload.source || "web",
  };

  const score = qualifyLead(lead.message);
  const saved = await upsertLead(supabase, {
    ...lead,
    score,
    status: "new",
  });

  const action = routeLead(lead.message, score);

  await trackFunnelEvent({
    email: lead.email || undefined,
    step: "lead_created",
    metadata: {
      source: lead.source,
      score,
      leadId: saved.id,
    },
  });

  return NextResponse.json({
    success: true,
    leadId: saved.id,
    action,
  });
}
