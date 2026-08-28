import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refreshGoogleToken } from "@/lib/google/refresh";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createSheetWithToken(accessToken: string) {
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: "Test Sheet from AI" },
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `Google Sheets API failed (${response.status})`;
    throw new Error(message);
  }

  return body?.spreadsheetId as string | undefined;
}

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return Response.json(
      { success: false, error: "Diagnostic authentication is not configured" },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  let user: { id: string; google_access_token: string | null; google_refresh_token: string | null } | null = null;
  let dbErrorMsg: string | undefined;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, google_access_token, google_refresh_token")
      .not("google_access_token", "is", null)
      .limit(1)
      .maybeSingle();
    if (error) dbErrorMsg = error.message;
    else user = data;
  } catch (e) {
    return NextResponse.json({ success: false, step: "supabase_query", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  if (dbErrorMsg) {
    return NextResponse.json({ success: false, step: "supabase_error", error: dbErrorMsg }, { status: 500 });
  }

  if (!user?.google_access_token) {
    return NextResponse.json({ success: false, step: "no_token", error: "No user with google_access_token found in profiles" }, { status: 404 });
  }

  try {
    const sheetId = await createSheetWithToken(user.google_access_token);

    return NextResponse.json({
      success: true,
      refreshed: false,
      sheetId,
    });
  } catch (error) {
    const googleError = error instanceof Error ? error.message : String(error);
    let refreshed: Awaited<ReturnType<typeof refreshGoogleToken>> | null = null;
    try {
      refreshed = await refreshGoogleToken(user);
    } catch (refreshError) {
      return NextResponse.json(
        {
          success: false,
          step: "refresh_failed",
          googleError,
          refreshError: refreshError instanceof Error ? refreshError.message : String(refreshError),
        },
        { status: 502 }
      );
    }

    if (!refreshed?.access_token) {
      return NextResponse.json(
        { success: false, step: "no_refresh_token", googleError },
        { status: 502 }
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ google_access_token: refreshed.access_token })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const sheetId = await createSheetWithToken(refreshed.access_token);

    return NextResponse.json({
      success: true,
      refreshed: true,
      sheetId,
    });
  }
}
