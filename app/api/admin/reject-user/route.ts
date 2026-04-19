import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyUserRejected } from "@/lib/notifications/adminAlert";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, reason, adminNotes } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Get user by email
    const { data: userData, error: userError } = await supabaseServer
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update user access status to rejected
    const { error: updateError } = await supabaseServer
      .from("users")
      .update({ access_status: "rejected" })
      .eq("id", userData.id);

    if (updateError) throw updateError;

    // Update access request status
    const { error: requestError } = await supabaseServer
      .from("access_requests")
      .update({
        status: "rejected",
        admin_notes: adminNotes,
      })
      .eq("email", email);

    if (requestError) throw requestError;

    // Get user name from access request
    const { data: requestData } = await supabaseServer
      .from("access_requests")
      .select("name")
      .eq("email", email)
      .single();

    const userName = requestData?.name || email;

    // Send rejection notification to user
    await notifyUserRejected(email, userName, reason);

    return NextResponse.json({
      status: "rejected",
      message: `User ${email} access request has been rejected. A notification email has been sent.`,
      userId: userData.id,
    });
  } catch (error) {
    console.error("User rejection error:", error);
    return NextResponse.json(
      { error: "Failed to reject user" },
      { status: 500 }
    );
  }
}
