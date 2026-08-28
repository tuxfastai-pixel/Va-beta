import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { buildInterviewPreparationSync } from "@/lib/assist/interviewPreparationSync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authenticatedUser = await getSessionUser();

    if (!authenticatedUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as {
      userId?: string;
      user_id?: string;
      transcript?: string;
      stageHint?: string;
      confidenceLevel?: number;
    };

    const requestedUserId = String(body.userId || body.user_id || "").trim();

    if (requestedUserId && requestedUserId !== authenticatedUser.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const userId = authenticatedUser.userId;

    const result = await buildInterviewPreparationSync({
      userId,
      transcript: body.transcript,
      stageHint: body.stageHint,
      confidenceLevel: Number(body.confidenceLevel || 0) || undefined,
    });

    return NextResponse.json({
      success: true,
      asOf: new Date().toISOString(),
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to build interview preparation sync",
      },
      { status: 500 }
    );
  }
}
