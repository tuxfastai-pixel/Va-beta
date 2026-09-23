type ClientLike = {
  payment_verified?: boolean;
  rating?: number;
  total_spent?: number;
  hire_rate?: number;
  response_time?: string;
};

export function calculateTrustScore(client: ClientLike) {
  let score = 0;

  if (client.payment_verified) {
    score += 25;
  }

  score += Math.min(Number(client.rating || 0) * 10, 50);

  if (Number(client.total_spent || 0) > 1000) {
    score += 15;
  }

  if (Number(client.total_spent || 0) > 10000) {
    score += 10;
  }

  if (Number(client.hire_rate || 0) > 0.6) {
    score += 15;
  }

  if (String(client.response_time || "").toLowerCase() === "fast") {
    score += 10;
  }

  return Math.min(score, 100);
}
