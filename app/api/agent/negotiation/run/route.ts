import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { generateReply } from "@/lib/agents/negotiationAgent";
import { trackInteraction } from "@/lib/outreach/dealFlow";

const SAFE_MODE = String(process.env.SAFE_MODE || "true") === "true";
const MAX_OUTREACH_PER_RUN = Number(process.env.MAX_OUTREACH_PER_RUN || 20);
const MAX_OUTREACH_PER_DAY = Number(process.env.MAX_OUTREACH_PER_DAY || 100);

export async function POST() {
  try {
    const startOfDayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { count: todayOutboundCount, error: dailyCountErr } = await supabaseServer
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("created_at", startOfDayIso);

    if (dailyCountErr) {
      return NextResponse.json({ success: false, error: dailyCountErr.message }, { status: 500 });
    }

    if (Number(todayOutboundCount || 0) >= MAX_OUTREACH_PER_DAY) {
      return NextResponse.json({
        success: true,
        capped: true,
        processed: 0,
        message: "Daily outreach limit reached",
      });
    }

    const { data: leads, error: leadsErr } = await supabaseServer
      .from("leads")
      .select("id, message")
      .eq("status", "replied")
      .limit(MAX_OUTREACH_PER_RUN);

    if (leadsErr) {
      return NextResponse.json({ success: false, error: leadsErr.message }, { status: 500 });
    }

    if (SAFE_MODE) {
      return NextResponse.json({
        success: true,
        preview: true,
        processed: (leads || []).length,
        message: "SAFE_MODE enabled. No outbound interactions stored.",
      });
    }

    let processed = 0;

    for (const lead of leads || []) {
      const reply = generateReply({
        clientMessage: String(lead.message || ""),
        job: {},
      });

      await trackInteraction({
        leadId: String(lead.id),
        message: reply,
        direction: "outbound",
      });

      processed += 1;
    }

    return NextResponse.json({
      success: true,
      processed,
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
