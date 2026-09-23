type JobLike = { description?: string | null };
type ClientLike = { payment_verified?: boolean; hire_rate?: number };

export function calculateRiskScore(job: JobLike, client: ClientLike) {
  let risk = 0;
  const text = String(job.description || "").toLowerCase();

  if (/free|test task|sample before hire/.test(text)) {
    risk += 25;
  }

  if (/telegram|whatsapp|move off platform/.test(text)) {
    risk += 30;
  }

  if (/cheap|lowest bidder/.test(text)) {
    risk += 20;
  }

  if (!client.payment_verified) {
    risk += 20;
  }

  if (Number(client.hire_rate || 0) < 0.2) {
    risk += 15;
  }

  return Math.min(risk, 100);
}
