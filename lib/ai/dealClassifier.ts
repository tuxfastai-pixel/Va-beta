type JobLike = {
  title?: string | null;
  description?: string | null;
  budget?: { min?: number; max?: number } | null;
};

export function classifyDeal(job: JobLike) {
  const desc = String(job.description || "").toLowerCase();

  const urgency = /urgent|asap|immediately/.test(desc) ? "high" : "medium";
  const complexity = desc.length > 800 || /advanced|expert|complex/.test(desc) ? "high" : "medium";

  return {
    urgency,
    complexity,
    budgetRange: {
      min: Number(job.budget?.min || 0),
      max: Number(job.budget?.max || 0),
    },
  };
}
