import { NextResponse } from "next/server";
import { getUserKPI } from "@/lib/analytics/kpiService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = String(searchParams.get("userId") || "").trim();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const data = await getUserKPI(userId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load KPI" },
      { status: 500 }
    );
  }
}
