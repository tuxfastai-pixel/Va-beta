import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/access-requests
 * Fetch pending access requests
 */
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status") || "pending";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

    const { data, error } = await supabaseServer
      .from("access_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      requests: data,
      count: data?.length,
    });
  } catch (error) {
    console.error("Fetch requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch access requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/access-requests
 * Bulk update access request statuses
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, status, adminNotes } = body;

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: "Request IDs array required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from("access_requests")
      .update({
        status,
        admin_notes: adminNotes,
      })
      .in("id", ids);

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      count: ids.length,
      message: `${ids.length} request(s) updated to ${status}`,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Failed to update requests" },
      { status: 500 }
    );
  }
}
