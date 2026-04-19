import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const allowed = (process.env.ALLOWED_USER_EMAILS || "friend1@email.com")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "email and password are required" },
        { status: 400 }
      );
    }

    if (!allowed.includes(email)) {
      return NextResponse.json(
        { success: false, error: "Access restricted" },
        { status: 403 }
      );
    }

    // Fetch user by email
    const { data: user, error } = await supabaseServer
      .from("client_users")
      .select("id, email, name, role, password, created_at")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Compare password hash
    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    // Set secure httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
      },
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
