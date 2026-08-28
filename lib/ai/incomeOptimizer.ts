type Metrics = {
  replyRate: number;
  conversionRate: number;
  earningsPerApp: number;
};

export function scoreCareer(metrics: Metrics) {
  return (
    metrics.replyRate * 0.3 +
    metrics.conversionRate * 0.4 +
    metrics.earningsPerApp * 0.3
  );
}
