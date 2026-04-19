import { NextResponse } from "next/server";
import { autoApplyToJobs } from "@/lib/jobs/autoApplyEngine";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

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
