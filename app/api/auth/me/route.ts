import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";

type SessionTokenPayload = jwt.JwtPayload & {
  userId?: string;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let decoded: string | SessionTokenPayload;
    try {
      decoded = jwt.verify(sessionToken, process.env.JWT_SECRET! as string) as string | SessionTokenPayload;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = typeof decoded === "string" ? null : decoded.userId;
    if (!userId) {
      return NextResponse.json({ error: "Invalid session payload" }, { status: 401 });
    }

    const { data: user, error } = await supabaseServer
      .from("client_users")
      .select("id, email, name, role, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
