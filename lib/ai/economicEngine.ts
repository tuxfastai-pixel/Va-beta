type EconomicJob = {
  pay_amount: number;
  automation_score: number;
  estimated_hours: number;
};

export function evaluateJobProfitability(job: EconomicJob) {
  const hourlyRate = job.pay_amount;
  const automationLevel = job.automation_score;

  const aiCost = 0.02 * job.estimated_hours;

  const profitScore =
    (hourlyRate * automationLevel / 100) - aiCost;

  return Math.round(profitScore);
}
