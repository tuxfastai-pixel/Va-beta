import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

interface EmailAccountRequest {
  email: string;
  smtp_host: string;
  smtp_port?: number;
  smtp_user: string;
  smtp_pass: string;
  daily_limit?: number;
  status?: string;
}

/**
 * POST: Add new email account
 */
export async function POST(req: Request) {
  try {
    const SAFE_MODE = process.env.SAFE_MODE === "true";

    const body = (await req.json().catch(() => null)) as EmailAccountRequest | null;

    if (!body || !body.email || !body.smtp_host || !body.smtp_user || !body.smtp_pass) {
      return NextResponse.json(
        { error: "Missing required fields: email, smtp_host, smtp_user, smtp_pass" },
        { status: 400 }
      );
    }

    if (SAFE_MODE) {
      return NextResponse.json(
        {
          preview: "SAFE_MODE: Would add new email account",
          account: body.email,
          host: body.smtp_host,
          port: body.smtp_port || 587,
          dailyLimit: body.daily_limit || 100,
        },
        { status: 200 }
      );
    }

    // Check if account already exists
    const { data: existing } = await supabaseServer
      .from("email_accounts")
      .select("id")
      .eq("email", body.email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Account already exists" },
        { status: 409 }
      );
    }

    // Insert new account
    const { data: account, error } = await supabaseServer
      .from("email_accounts")
      .insert({
        email: body.email,
        smtp_host: body.smtp_host,
        smtp_port: body.smtp_port || 587,
        smtp_user: body.smtp_user,
        smtp_pass: body.smtp_pass,
        daily_limit: body.daily_limit || 100,
        status: "active",
      })
      .select("id, email, status, daily_limit, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, account },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET: List all email accounts
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    let query = supabaseServer
      .from("email_accounts")
      .select("id, email, status, daily_limit, sent_today, sent_total, reply_rate, bounce_rate, warmup_days, created_at, updated_at");

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accounts: data,
      total: data?.length || 0,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PUT: Update email account
 */
export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("id");
    const body = (await req.json().catch(() => null)) as Partial<EmailAccountRequest> | null;

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Build update object (exclude email to prevent changes)
    const updateData: Record<string, string | number> = {
      updated_at: new Date().toISOString(),
    };

    if (body.smtp_host) updateData.smtp_host = body.smtp_host;
    if (body.smtp_port) updateData.smtp_port = body.smtp_port;
    if (body.smtp_user) updateData.smtp_user = body.smtp_user;
    if (body.smtp_pass) updateData.smtp_pass = body.smtp_pass;
    if (body.daily_limit) updateData.daily_limit = body.daily_limit;
    if (body.status) updateData.status = body.status;

    const { data, error } = await supabaseServer
      .from("email_accounts")
      .update(updateData)
      .eq("id", accountId)
      .select("id, email, status, daily_limit")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account: data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove email account
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from("email_accounts")
      .delete()
      .eq("id", accountId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
