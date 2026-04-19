import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyUserApproved } from "@/lib/notifications/adminAlert";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, adminNotes } = body;

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

    // Update user access status
    const { error: updateError } = await supabaseServer
      .from("users")
      .update({ access_status: "approved" })
      .eq("id", userData.id);

    if (updateError) throw updateError;

    // Update access request status
    const { error: requestError } = await supabaseServer
      .from("access_requests")
      .update({
        status: "approved",
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

    // Send approval notification to user
    await notifyUserApproved(email, userName);

    return NextResponse.json({
      status: "approved",
      message: `User ${email} has been approved. A confirmation email has been sent.`,
      userId: userData.id,
    });
  } catch (error) {
    console.error("User approval error:", error);
    return NextResponse.json(
      { error: "Failed to approve user" },
      { status: 500 }
    );
  }
}
