export type NormalizedJob = {
  title: string;
  company: string;
  description: string;
  location: string;
  salary: number;
  country: string;
  currency: string;
  pay_amount: number;
  source: string;
  external_id: string;
};

type RawJob = {
  source?: string | null;
  id?: string | number | null;
  url?: string | null;
  title?: string | null;
  position?: string | null;
  company?: string | null;
  company_name?: string | null;
  description?: string | null;
  location?: string | null;
  country?: string | null;
  salary?: string | number | null;
  pay_amount?: string | number | null;
  currency?: string | null;
  pay_currency?: string | null;
  [key: string]: unknown;
};

export function normalizeJob(rawJob: RawJob, source: string): NormalizedJob {
  return {
    title: String(rawJob.title || rawJob.position || "Untitled Job"),
    company: String(rawJob.company || rawJob.company_name || "Unknown Company"),
    description: String(rawJob.description || "No description provided."),
    location: String(rawJob.location || rawJob.country || "Global"),
    salary: Number(rawJob.salary || rawJob.pay_amount || 0),
    country: String(rawJob.country || rawJob.location || "Global"),
    currency: String(rawJob.currency || rawJob.pay_currency || "USD").toUpperCase(),
    pay_amount: Number(rawJob.pay_amount || rawJob.salary || 0),
    source,
    external_id: String(rawJob.id || rawJob.url || `${source}-${Date.now()}`),
  };
}
