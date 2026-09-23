import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveLoginRedirectStage } from "@/lib/career/careerJourneyService.ts";

function normalizeRole(role: unknown) {
  return String(role || "").trim().toLowerCase();
}

function isFounderRole(role: unknown) {
  return ["founder", "admin", "owner", "super_admin"].includes(normalizeRole(role));
}

function isAdminRole(role: unknown) {
  return ["admin", "super_admin"].includes(normalizeRole(role));
}

async function resolvePostAuthRedirect(params: {
  userId: string;
  role: unknown;
  founderEnabled: boolean;
  onboardingCompleted: boolean;
}) {
  if (!params.onboardingCompleted) {
    return "/onboarding";
  }

  // For onboarding-complete users, always resume activation journey before portal routing.
  try {
    const result = await resolveLoginRedirectStage(params.userId);
    if (result?.redirectTo === "/dashboard") {
      return "/client-portal";
    }

    if (result?.redirectTo) {
      return result.redirectTo;
    }
  } catch (err) {
    console.error("Error resolving career activation stage:", err);
  }

  if (isAdminRole(params.role)) {
    return "/admin/governance-control-room";
  }

  if (params.founderEnabled) {
    return "/client-portal?mode=founder";
  }

  return "/career-activation/complete";
}

function founderEmailsFromEnv() {
  return (process.env.FOUNDER_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isFounderEmail(email: string) {
  return founderEmailsFromEnv().includes(String(email || "").trim().toLowerCase());
}

function isSeedFounderFromAllowed(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const firstAllowed = (process.env.ALLOWED_USER_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)[0];

  if (!firstAllowed) {
    return false;
  }

  return normalizedEmail === firstAllowed;
}

async function isPrimaryRegisteredUser(userId: string) {
  const { data, error } = await supabaseServer
    .from("client_users")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return false;
  }

  return String(data?.id || "") === String(userId || "");
}

function isRecoverableOnboardingError(message: string | undefined) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("could not find the table") ||
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("fetch failed") ||
    text.includes("network")
  );
}

async function hasCompletedOnboarding(userId: string) {
  const { data, error } = await supabaseServer
    .from("career_activation_states")
    .select("onboarding_completed, completed_step")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) {
    const onboardingCompleted = Boolean((data as { onboarding_completed?: boolean } | null)?.onboarding_completed);
    const completedStep = Number((data as { completed_step?: number } | null)?.completed_step || 0);
    return onboardingCompleted || completedStep >= 5;
  }

  if (isRecoverableOnboardingError(error.message)) {
    const { data: profileData, error: profileError } = await supabaseServer
      .from("career_profiles")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profileError) {
      return Boolean(profileData?.id);
    }

    return false;
  }

  throw new Error(error.message);
}

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

    const founderEnabled =
      isFounderRole(user.role) ||
      isFounderEmail(user.email) ||
      isSeedFounderFromAllowed(user.email) ||
      (await isPrimaryRegisteredUser(user.id));
    const onboardingCompleted = await hasCompletedOnboarding(user.id);
    const redirectTo = await resolvePostAuthRedirect({
      userId: user.id,
      role: user.role,
      founderEnabled,
      onboardingCompleted,
    });

    return NextResponse.json({
      success: true,
      onboardingCompleted,
      redirectTo,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        founderEnabled,
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
