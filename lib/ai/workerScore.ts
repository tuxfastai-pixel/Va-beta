type WorkerScoreInput = {
  jobs_won: number;
  applications_sent: number;
  client_rating: number;
  response_speed: number;
  earnings_factor: number;
};

export function calculateWorkerScore(data: WorkerScoreInput) {
  const successRate = data.jobs_won / Math.max(data.applications_sent, 1);

  const score =
    successRate * 40 +
    data.client_rating * 30 +
    data.response_speed * 20 +
    data.earnings_factor * 10;

  return Math.round(score);
}
