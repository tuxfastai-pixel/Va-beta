import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyAccessRequest } from "@/lib/notifications/adminAlert";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, reason } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseServer
      .from("users")
      .select("id, access_status")
      .eq("email", email)
      .maybeSingle();

    // If user exists and already has access, return success
    if (existingUser?.access_status === "approved") {
      return NextResponse.json({
        status: "already_approved",
        message: "You already have access!",
      });
    }

    // If user exists and is pending/rejected, update their access request
    if (existingUser) {
      const { error: requestError } = await supabaseServer
        .from("access_requests")
        .update({
          name,
          reason,
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
        })
        .eq("user_id", existingUser.id)
        .eq("status", "rejected");

      if (requestError && requestError.code !== "PGRST116") {
        throw requestError;
      }

      // If no rejected request exists, create new one
      if (!requestError || requestError.code === "PGRST116") {
        const { error: insertError } = await supabaseServer
          .from("access_requests")
          .insert({
            user_id: existingUser.id,
            email,
            name,
            reason,
            status: "pending",
          });

        if (insertError) throw insertError;
      }
    } else {
      // Create new user with pending status
      const { error: userError } = await supabaseServer
        .from("users")
        .insert({
          email,
          access_status: "pending",
        });

      if (userError) throw userError;

      // Get the new user ID
      const { data: newUser } = await supabaseServer
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      // Create access request
      const { error: requestError } = await supabaseServer
        .from("access_requests")
        .insert({
          user_id: newUser?.id,
          email,
          name,
          reason,
          status: "pending",
        });

      if (requestError) throw requestError;
    }

    // Get admin user (first user with admin role or highest ID)
    const { data: adminUsers } = await supabaseServer
      .from("users")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1);

    const adminUserId = adminUsers?.[0]?.id;

    // Send notifications
    await notifyAccessRequest(email, name, adminUserId);

    return NextResponse.json({
      status: "pending",
      message: "Your access request has been submitted for approval. You will be notified once processed.",
    });
  } catch (error) {
    console.error("Access request error:", error);
    return NextResponse.json(
      { error: "Failed to submit access request" },
      { status: 500 }
    );
  }
}

/**
 * GET - Check access status for logged-in user
 */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("users")
      .select("id, access_status")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({
        status: "not_found",
        access: false,
      });
    }

    return NextResponse.json({
      status: data.access_status,
      access: data.access_status === "approved",
      userId: data.id,
    });
  } catch (error) {
    console.error("Access check error:", error);
    return NextResponse.json(
      { error: "Failed to check access status" },
      { status: 500 }
    );
  }
}
