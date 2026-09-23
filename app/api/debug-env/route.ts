import { NextResponse } from "next/server";

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const redisHost = process.env.REDIS_HOST;

  return NextResponse.json({
    hasSupabase: !!supabaseUrl,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSupabaseUrl: !!supabaseUrl,
    supabaseUrlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : null,
    hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
    hasRedisHost: !!redisHost,
    redisHostValue: redisHost,
    isRedisLocalhost: !!redisHost && (redisHost.includes("127.0.0.1") || redisHost.includes("localhost")),
    allKeys: Object.keys(process.env)
      .filter(k => k.includes("SUPABASE") || k.includes("REDIS") || k.includes("GOOGLE"))
      .sort(),
    timestamp: new Date().toISOString(),
  });
}
