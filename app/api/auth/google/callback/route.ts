import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.json(
      { success: false, error: `Google OAuth error: ${oauthError}` },
      { status: 400 }
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { success: false, error: "Missing code or state" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("oauth_state")?.value;
  const oauthUserId = String(cookieStore.get("oauth_user_id")?.value || "").trim();
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.json(
      { success: false, error: "Invalid OAuth state" },
      { status: 400 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || url.origin;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { success: false, error: "Google OAuth credentials are missing" },
      { status: 500 }
    );
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.json(
      {
        success: false,
        error: tokenJson.error_description || tokenJson.error || "Token exchange failed",
      },
      { status: 502 }
    );
  }

  let profileUpdated = false;
  let profileUpdateError: string | null = null;

  if (oauthUserId) {
    const { error: persistError } = await supabaseServer
      .from("profiles")
      .update({
        google_access_token: tokenJson.access_token,
        google_refresh_token: tokenJson.refresh_token || null,
      })
      .eq("id", oauthUserId);

    if (persistError) {
      profileUpdateError = persistError.message;
    } else {
      profileUpdated = true;
    }
  } else {
    profileUpdateError = "No oauth user id found; tokens only stored in cookies";
  }

  const response = NextResponse.json({
    success: true,
    hasAccessToken: true,
    hasRefreshToken: !!tokenJson.refresh_token,
    tokenType: tokenJson.token_type || "Bearer",
    expiresIn: tokenJson.expires_in || null,
    profileUpdated,
    profileUpdateError,
  });

  response.cookies.set("oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("oauth_user_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("google_access_token", tokenJson.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, (tokenJson.expires_in || 3600) - 30),
  });

  if (tokenJson.refresh_token) {
    response.cookies.set("google_refresh_token", tokenJson.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
