type PlatformPerformance = {
  applications?: number;
  conversions?: number;
  revenue?: number;
};

export function scorePlatform(performance: PlatformPerformance) {
  const applications = Number(performance.applications || 0);
  const conversions = Number(performance.conversions || 0);
  const revenue = Number(performance.revenue || 0);

  const conversionRate = applications ? conversions / applications : 0;
  const earningsPerApp = applications ? revenue / applications : 0;

  return conversionRate * 0.5 + earningsPerApp * 0.5;
}
