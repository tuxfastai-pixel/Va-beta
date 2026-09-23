export type FlexJob = {
  title: string;
  description: string;
  budget: { min: number; max: number };
  platform: "flexjobs";
  client: Record<string, unknown>;
  remote: boolean;
  type: "long_term";
};

export async function fetchFlexJobs(career: string): Promise<FlexJob[]> {
  const url = `https://api.flexjobs.com/search?q=${encodeURIComponent(career)}`;

  const jobs = await fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        return [] as Array<Record<string, unknown>>;
      }

      const payload = (await res.json()) as { jobs?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      return Array.isArray(payload) ? payload : (payload.jobs || []);
    })
    .catch(() => [] as Array<Record<string, unknown>>);

  return jobs.map((job) => ({
    title: String(job.title || "Untitled"),
    description: String(job.description || ""),
    budget: {
      min: Number((job.budget as { min?: unknown } | undefined)?.min || 0),
      max: Number((job.budget as { max?: unknown } | undefined)?.max || 0),
    },
    platform: "flexjobs",
    remote: true,
    type: "long_term",
    client: (job.client as Record<string, unknown> | undefined) || {},
  }));
}

export const fetchFlixJobs = fetchFlexJobs;
