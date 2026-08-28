type PlatformMetrics = {
  replyRate: number;
  conversionRate: number;
  earningsPerApp: number;
};

export function scorePlatform(metrics: PlatformMetrics) {
  return (
    metrics.replyRate * 0.3 +
    metrics.conversionRate * 0.4 +
    metrics.earningsPerApp * 0.3
  );
}
