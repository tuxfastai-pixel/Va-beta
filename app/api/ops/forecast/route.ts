import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/security/rateLimiter";
import { getRevenueForecast } from "@/lib/prediction/revenueForecast";
import { forecastCapacity } from "@/lib/prediction/capacityForecast";
import { predictChurn } from "@/lib/prediction/churnPredictor";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(async (_req: NextRequest) => {
  const [revenueForecast, capacityRisk, predictedChurn] = await Promise.all([
    getRevenueForecast(),
    forecastCapacity(14),
    predictChurn(8),
  ]);

  return NextResponse.json({
    success: true,
    asOf: new Date().toISOString(),
    revenue: {
      sevenDay: revenueForecast.forecast7Day,
      thirtyDay: revenueForecast.forecast30Day,
      recurringTrend: {
        sevenDayRecurringProjection: revenueForecast.forecast7Day.projectedRecurringRevenue,
        thirtyDayRecurringProjection: revenueForecast.forecast30Day.projectedRecurringRevenue,
      },
    },
    capacityRisk,
    predictedChurn,
  });
}, {
  namespace: "api:ops:forecast",
  limit: 60,
  windowSeconds: 60,
});
