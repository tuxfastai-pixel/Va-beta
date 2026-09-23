type JobLike = {
  title?: string | null;
  description?: string | null;
};

export function detectCareerFromJob(job: JobLike, careers: string[]) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();

  for (const career of careers) {
    if (text.includes(String(career).toLowerCase())) {
      return career;
    }
  }

  return careers[0] || "general";
}
