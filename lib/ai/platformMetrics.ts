type PlatformData = {
  applications?: number;
  replies?: number;
  conversions?: number;
  revenue?: number;
};

export function calculatePlatformMetrics(data: PlatformData) {
  const applications = Number(data.applications || 0);
  const replies = Number(data.replies || 0);
  const conversions = Number(data.conversions || 0);
  const revenue = Number(data.revenue || 0);

  return {
    replyRate: applications ? replies / applications : 0,
    conversionRate: replies ? conversions / replies : 0,
    earningsPerApp: applications ? revenue / applications : 0,
  };
}
