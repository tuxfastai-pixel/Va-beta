type JobLike = { title?: string | null };

type ProfileLike = {
  primary_career?: string | null;
  secondary_careers?: string[] | null;
};

export function matchJobsByCareers(jobs: JobLike[], profile: ProfileLike) {
  const primary = String(profile.primary_career || "").toLowerCase();
  const secondary = Array.isArray(profile.secondary_careers)
    ? profile.secondary_careers.map((c) => String(c || "").toLowerCase()).filter(Boolean)
    : [];

  const primaryJobs = jobs.filter((job) => String(job.title || "").toLowerCase().includes(primary));
  const secondaryJobs = jobs.filter((job) =>
    secondary.some((career) => String(job.title || "").toLowerCase().includes(career))
  );

  const secondaryCap = Math.max(1, Math.floor(primaryJobs.length * 0.4));

  return {
    primary: primaryJobs,
    secondary: secondaryJobs.slice(0, secondaryCap),
  };
}
