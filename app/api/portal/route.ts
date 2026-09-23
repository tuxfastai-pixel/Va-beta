import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/portal
 * Returns contracts and invoices for the authenticated client
 * In production, you'd check auth headers to verify client identity
 */
export async function GET() {
  try {
    // Fetch contracts
    const { data: contracts, error: contractsError } = await supabaseServer
      .from("contracts")
      .select("id, deal_id, status, signed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch invoices
    const { data: invoices, error: invoicesError } = await supabaseServer
      .from("invoices")
      .select(
        "id, amount, status, due_date, payment_link, paid_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (contractsError || invoicesError) {
      console.error("[portal] Database error:", {
        contractsError,
        invoicesError,
      });
      return NextResponse.json(
        { error: "Failed to fetch portal data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contracts: contracts || [],
      invoices: invoices || [],
    });
  } catch (err) {
    console.error("[portal] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
