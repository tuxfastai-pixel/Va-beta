type ClientLike = {
  total_spent?: number;
  hire_rate?: number;
  reviews_count?: number;
};

export function estimateClientValue(client: ClientLike) {
  let value = Number(client.total_spent || 0);

  if (Number(client.hire_rate || 0) > 0.5) {
    value *= 1.2;
  }

  if (Number(client.reviews_count || 0) > 20) {
    value *= 1.1;
  }

  return value;
}
