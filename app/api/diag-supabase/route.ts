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
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url) {
      return Response.json({ error: "Missing SUPABASE_URL" });
    }

    if (!anonKey) {
      return Response.json({ error: "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY" });
    }

    const parsed = new URL(url);

    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: anonKey,
      },
      cache: "no-store",
    });

    return Response.json({
      success: true,
      host: parsed.hostname,
      status: res.status,
    });
  } catch (err: unknown) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}