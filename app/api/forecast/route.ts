import { NextRequest, NextResponse } from "next/server";
import {
  saveForecast,
  getLatestForecast,
  adjustStrategyFromForecast,
} from "@/lib/forecast/forecastEngine";
import { isUuid } from "@/lib/clients/clientApiAuth";

// GET /api/forecast?userId=<uuid>&goalTarget=<number>
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const goalTarget = req.nextUrl.searchParams.get("goalTarget");

  if (!userId || !isUuid(userId)) {
    return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
  }

  const forecast = await getLatestForecast(userId);
  if (!forecast) {
    return NextResponse.json({ error: "No forecast available. POST to generate one." }, { status: 404 });
  }

  const strategy = goalTarget
    ? adjustStrategyFromForecast(forecast, parseFloat(goalTarget))
    : null;

  return NextResponse.json({ forecast, strategy });
}

// POST /api/forecast  { userId: uuid, goalTarget?: number }
export async function POST(req: NextRequest) {
  let body: { userId?: string; goalTarget?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId || !isUuid(body.userId)) {
    return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
  }

  const forecast = await saveForecast(body.userId);
  const strategy = body.goalTarget
    ? adjustStrategyFromForecast(forecast, body.goalTarget)
    : null;

  return NextResponse.json({ forecast, strategy });
}
