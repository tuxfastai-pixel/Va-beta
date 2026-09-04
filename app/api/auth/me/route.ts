import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveLoginRedirectStage } from "@/lib/career/careerJourneyService.ts";

type SessionTokenPayload = jwt.JwtPayload & {
  userId?: string;
};

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

  try {
    const result = await resolveLoginRedirectStage(params.userId);
    if (result?.redirectTo === "/dashboard") {
      return "/client-portal";
    }

    if (result?.redirectTo) {
      return result.redirectTo;
    }
  } catch {
    // Fall through to legacy redirect logic.
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
      user: {
        ...user,
        founderEnabled,
      },
      onboardingCompleted,
      redirectTo,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
