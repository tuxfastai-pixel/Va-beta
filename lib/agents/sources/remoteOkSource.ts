type RemoteOkJob = {
  position?: string | null;
  company?: string | null;
  description?: string | null;
  salary_min?: number | null;
};

export async function discoverRemoteOKJobs() {
  const res = await fetch("https://remoteok.com/api");
  const data = (await res.json()) as RemoteOkJob[];

  const jobs = (Array.isArray(data) ? data.slice(1) : []).map((job) => ({
    title: job.position,
    company: job.company,
    description: job.description,
    country: "Global",
    currency: "USD",
    pay_amount: job.salary_min || 30,
  }));

  return jobs;
}
