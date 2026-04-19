import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const companyId = String(req.nextUrl.searchParams.get("company_id") || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("client_users")
    .select("id, email, name, role, company_id, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = String(body?.company_id || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const role = String(body?.role || "member").trim();

    if (!companyId || !email) {
      return NextResponse.json({ error: "company_id and email are required" }, { status: 400 });
    }

    const { data: existingUser } = await supabaseServer
      .from("client_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser?.id) {
      const { data, error } = await supabaseServer
        .from("client_users")
        .update({ company_id: companyId, role, name: name || null })
        .eq("id", existingUser.id)
        .select("id, email, name, role, company_id")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ member: data, invited: false });
    }

    const temporaryPassword = `invite-${Math.random().toString(36).slice(2, 12)}`;
    const { data, error } = await supabaseServer
      .from("client_users")
      .insert({
        email,
        password: temporaryPassword,
        name: name || null,
        role,
        company_id: companyId,
      })
      .select("id, email, name, role, company_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ member: data, invited: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }
}
