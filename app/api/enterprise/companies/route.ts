import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("companies")
    .select("id, name, plan, created_at, license_per_user_usd")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ companies: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const plan = String(body?.plan || "starter").trim();
    const licensePerUser = Number(body?.license_per_user_usd || 10);

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("companies")
      .insert({
        name,
        plan,
        license_per_user_usd: Number.isFinite(licensePerUser) ? licensePerUser : 10,
      })
      .select("id, name, plan, created_at, license_per_user_usd")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ company: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }
}
