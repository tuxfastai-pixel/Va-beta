type PerformanceData = {
  applications?: number;
  replies?: number;
  conversions?: number;
  revenue?: number;
};

export function calculateMetrics(data: PerformanceData) {
  const applications = Number(data.applications || 0);
  const replies = Number(data.replies || 0);
  const conversions = Number(data.conversions || 0);
  const revenue = Number(data.revenue || 0);

  const replyRate = applications > 0 ? replies / applications : 0;
  const conversionRate = replies > 0 ? conversions / replies : 0;
  const earningsPerApp = applications > 0 ? revenue / applications : 0;

  return {
    replyRate,
    conversionRate,
    earningsPerApp,
  };
}
