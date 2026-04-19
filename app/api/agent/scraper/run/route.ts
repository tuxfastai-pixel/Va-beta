import { NextResponse } from "next/server";
import { scrapeLeads } from "@/lib/leads/scraper";
import { storeLeads } from "@/lib/leads/storeLeads";

const SAFE_MODE = String(process.env.SAFE_MODE || "true") === "true";

export async function POST() {
  try {
    const leads = await scrapeLeads();

    if (SAFE_MODE) {
      return NextResponse.json({
        success: true,
        preview: true,
        count: leads.length,
        message: "SAFE_MODE enabled. Leads were scraped but not stored.",
      });
    }

    const stored = await storeLeads(leads);

    return NextResponse.json({
      success: true,
      count: stored,
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
