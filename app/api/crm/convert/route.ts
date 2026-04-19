import { NextResponse } from "next/server";
import { convertToDeal, markLeadConverted, trackInteraction } from "@/lib/outreach/dealFlow";
import { supabaseServer } from "@/lib/supabaseServer";
import { trackFunnelEvent } from "@/lib/analytics/funnelTracking";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const leadId = String(body?.leadId || "").trim();

    if (!leadId) {
      return NextResponse.json({ success: false, error: "leadId is required" }, { status: 400 });
    }

    // Fetch lead to get email
    const { data: lead } = await supabaseServer
      .from("leads")
      .select("email")
      .eq("id", leadId)
      .maybeSingle();

    const dealId = await convertToDeal(leadId);

    await trackInteraction({
      leadId,
      message: "Converted to deal",
      direction: "system",
    });

    await markLeadConverted(leadId);

    // Track funnel event if email is available
    if (lead?.email) {
      await trackFunnelEvent({
        email: lead.email,
        step: "outreach_sent",
        metadata: {
          leadId,
          dealId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      dealId,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
