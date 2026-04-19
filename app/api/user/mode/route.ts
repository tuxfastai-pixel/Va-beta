import { NextRequest, NextResponse } from "next/server";
import { getUserMode, setUserMode, type AiMode } from "@/lib/mode/modeManager";

export async function GET(req: NextRequest) {
  const userId = String(req.nextUrl.searchParams.get("userId") || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const mode = await getUserMode(userId);
  return NextResponse.json({ mode });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body?.userId || "").trim();
    const mode = String(body?.mode || "assist").trim() as AiMode;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (mode !== "assist" && mode !== "autonomous") {
      return NextResponse.json({ error: "mode must be assist or autonomous" }, { status: 400 });
    }

    await setUserMode(userId, mode);
    return NextResponse.json({ ok: true, mode });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }
}