type JobInput = {
  title?: string | null;
  description?: string | null;
  budget?: unknown;
  link?: string | null;
  platform?: string | null;
  platformWeight?: number | null;
  type?: string | null;
  remote?: boolean | null;
  createdAt?: Date | string | null;
  client?: unknown;
};

export function normalizeJob(job: JobInput) {
  return {
    title: job.title || "",
    description: job.description || "",
    budget: job.budget || { min: 0, max: 0 },
    link: job.link || "",
    platform: job.platform || "unknown",
    platformWeight: Number(job.platformWeight || 0),
    type: job.type || null,
    remote: Boolean(job.remote),
    createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
    client: (job.client as Record<string, unknown>) || {},
  };
}
