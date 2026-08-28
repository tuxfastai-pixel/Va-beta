import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { autoApplyToJobs } from "@/lib/jobs/autoApplyEngine";

export async function POST(req: Request) {
  try {
    const authenticatedUser = await getSessionUser();

    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const manualApplicationMode = process.env.PILOT_MANUAL_APPLICATION_MODE !== "false";
    if (manualApplicationMode) {
      return NextResponse.json(
        {
          success: false,
          error: "Auto-apply is disabled in pilot manual application mode",
          mode: "manual",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedUserId = String(body?.userId || "").trim();

    if (requestedUserId && requestedUserId !== authenticatedUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = authenticatedUser.userId;

    const applications = await autoApplyToJobs(userId);

    return NextResponse.json({
      success: true,
      applicationsCreated: applications.length,
      applications,
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
