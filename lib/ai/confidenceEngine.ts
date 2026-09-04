type ConfidenceData = {
  applications?: number;
};

export function calculateConfidence(data: ConfidenceData) {
  const applications = Number(data.applications || 0);

  if (applications > 30) {
    return 1;
  }

  if (applications > 10) {
    return 0.6;
  }

  return 0.3;
}
