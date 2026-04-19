import { NextResponse } from "next/server";
import { createViralContent, generateContent } from "@/lib/growth/viralContentEngine";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const metrics = body?.metrics || {};

    const generated = generateContent(metrics);
    const log = await createViralContent({
      clientId: body?.clientId,
      platform: body?.platform || "linkedin",
      metrics,
    });

    return NextResponse.json({
      success: true,
      content: generated,
      log,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
